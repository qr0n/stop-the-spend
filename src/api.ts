export type TurnUsage = {
  inputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  outputTokens: number;
};

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

export type Session = SessionSummary & { prompts: Prompt[] };

export async function fetchSessions(): Promise<SessionSummary[]> {
  const r = await fetch("/api/sessions");
  if (!r.ok) throw new Error(`/api/sessions ${r.status}`);
  const j = (await r.json()) as { sessions: SessionSummary[] };
  return j.sessions;
}

export async function fetchSession(id: string): Promise<Session> {
  const r = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`/api/sessions/${id} ${r.status}`);
  const j = (await r.json()) as { session: Session };
  return j.session;
}

export async function clearSessions(): Promise<void> {
  const r = await fetch("/api/clear", { method: "POST" });
  if (!r.ok) throw new Error(`/api/clear ${r.status}`);
}
