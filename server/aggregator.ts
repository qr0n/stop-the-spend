import { priceTurn, type TurnUsage } from "./pricing";

export type Prompt = {
  index: number;
  startedAt: string;
  endedAt: string | null;
  userText: string;
  turns: number;
  usage: TurnUsage;
  costUsd: number;
};

export type SessionSummary = {
  id: string;
  cwd: string;
  startedAt: string;
  lastActivity: string;
  models: string[];
  promptCount: number;
  totalUsage: TurnUsage;
  totalCostUsd: number;
};

export type Session = SessionSummary & {
  prompts: Prompt[];
};

type RawEvent = {
  type?: string;
  sessionId?: string;
  cwd?: string;
  timestamp?: string;
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: unknown;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
};

const sessions = new Map<string, Session>();
let clearedAt: string | null = null;

const zeroUsage = (): TurnUsage => ({
  inputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  outputTokens: 0,
});

function ensureSession(id: string, cwd: string, ts: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = {
      id,
      cwd,
      startedAt: ts,
      lastActivity: ts,
      models: [],
      promptCount: 0,
      totalUsage: zeroUsage(),
      totalCostUsd: 0,
      prompts: [],
    };
    sessions.set(id, s);
  }
  return s;
}

function isRealUserPrompt(content: unknown): boolean {
  if (typeof content === "string") return true;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as { type?: string } | undefined;
    return first?.type !== "tool_result";
  }
  return false;
}

function userTextSummary(content: unknown): string {
  if (typeof content === "string") return content.slice(0, 200);
  if (Array.isArray(content)) {
    for (const block of content as Array<{ type?: string; text?: string }>) {
      if (block?.type === "text" && typeof block.text === "string") {
        return block.text.slice(0, 200);
      }
    }
  }
  return "";
}

export function applyEvent(
  ev: RawEvent,
  fallbackSessionId: string,
  fallbackCwd: string
) {
  // sidechain events (subagent transcripts) come in via parent transcript;
  // skip to avoid double-counting nested agent costs against the parent prompt.
  if (ev.isSidechain) return;

  const sid = ev.sessionId ?? fallbackSessionId;
  const ts = ev.timestamp ?? new Date().toISOString();
  const cwd = ev.cwd ?? fallbackCwd;
  const session = ensureSession(sid, cwd, ts);
  if (ts > session.lastActivity) session.lastActivity = ts;

  if (ev.type === "user" && ev.message) {
    if (!isRealUserPrompt(ev.message.content)) return;
    const cur = session.prompts[session.prompts.length - 1];
    if (cur && cur.endedAt === null) cur.endedAt = ts;
    session.prompts.push({
      index: session.prompts.length,
      startedAt: ts,
      endedAt: null,
      userText: userTextSummary(ev.message.content),
      turns: 0,
      usage: zeroUsage(),
      costUsd: 0,
    });
    session.promptCount = session.prompts.length;
    return;
  }

  if (
    ev.type === "assistant" &&
    ev.message?.usage &&
    typeof ev.message.model === "string"
  ) {
    const usage: TurnUsage = {
      inputTokens: ev.message.usage.input_tokens ?? 0,
      outputTokens: ev.message.usage.output_tokens ?? 0,
      cacheCreationInputTokens: ev.message.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: ev.message.usage.cache_read_input_tokens ?? 0,
    };
    const cost = priceTurn(ev.message.model, usage);

    if (!session.models.includes(ev.message.model)) {
      session.models.push(ev.message.model);
    }

    if (session.prompts.length === 0) {
      session.prompts.push({
        index: 0,
        startedAt: ts,
        endedAt: null,
        userText: "(no user message recorded)",
        turns: 0,
        usage: zeroUsage(),
        costUsd: 0,
      });
      session.promptCount = 1;
    }
    const cur = session.prompts[session.prompts.length - 1]!;
    cur.turns += 1;
    cur.usage.inputTokens += usage.inputTokens;
    cur.usage.outputTokens += usage.outputTokens;
    cur.usage.cacheReadInputTokens += usage.cacheReadInputTokens;
    cur.usage.cacheCreationInputTokens += usage.cacheCreationInputTokens;
    cur.costUsd += cost;

    session.totalUsage.inputTokens += usage.inputTokens;
    session.totalUsage.outputTokens += usage.outputTokens;
    session.totalUsage.cacheReadInputTokens += usage.cacheReadInputTokens;
    session.totalUsage.cacheCreationInputTokens += usage.cacheCreationInputTokens;
    session.totalCostUsd += cost;
  }
}

export function setClearedAt(ts: string) {
  clearedAt = ts;
}

export function getClearedAt(): string | null {
  return clearedAt;
}

function isVisible(s: Session): boolean {
  return clearedAt === null || s.startedAt >= clearedAt;
}

export function listSummaries(): SessionSummary[] {
  return [...sessions.values()]
    .filter(isVisible)
    .map(({ prompts: _p, ...rest }) => rest)
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function getSession(id: string): Session | null {
  const s = sessions.get(id);
  if (!s || !isVisible(s)) return null;
  return s;
}

export function getActiveSessionId(): string | null {
  let best: Session | null = null;
  for (const s of sessions.values()) {
    if (!isVisible(s)) continue;
    if (!best || s.lastActivity > best.lastActivity) best = s;
  }
  return best?.id ?? null;
}

export function resetState() {
  sessions.clear();
}
