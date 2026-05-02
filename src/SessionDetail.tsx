import { useState } from "react";
import type { Prompt, Session } from "./api";

export function SessionDetail({ session }: { session: Session | null }) {
  if (!session) {
    return <div className="session-detail empty">select a session</div>;
  }

  return (
    <div className="session-detail">
      <header>
        <div className="session-title">
          <span className="session-id">{session.id.slice(0, 8)}</span>
          <span className="session-cwd">{session.cwd}</span>
        </div>
        <div className="big-cost">{fmtUsd(session.totalCostUsd)}</div>
        <div className="usage-line">
          {fmtTokens(session.totalUsage.inputTokens)} in /{" "}
          {fmtTokens(session.totalUsage.outputTokens)} out /{" "}
          {fmtTokens(session.totalUsage.cacheReadInputTokens)} cache read /{" "}
          {fmtTokens(session.totalUsage.cacheCreationInputTokens)} cache write
        </div>
        <div className="models">
          {session.models.length > 0 ? session.models.join(", ") : "(no models yet)"}
        </div>
      </header>

      <h3>Prompts</h3>
      {session.prompts.length === 0 ? (
        <div className="empty">no prompts in this session yet</div>
      ) : (
        <ul className="prompt-list">
          {session.prompts.map((p) => (
            <PromptRow key={p.index} prompt={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PromptRow({ prompt }: { prompt: Prompt }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="prompt-row">
      <button className="prompt-summary" onClick={() => setOpen((o) => !o)}>
        <span className="prompt-index">#{prompt.index + 1}</span>
        <span className="prompt-text">{prompt.userText || "(no text)"}</span>
        <span className="prompt-turns">{prompt.turns} turn{prompt.turns === 1 ? "" : "s"}</span>
        <span className="prompt-cost">{fmtUsd(prompt.costUsd)}</span>
      </button>
      {open && (
        <div className="prompt-detail">
          <div>started: {new Date(prompt.startedAt).toLocaleTimeString()}</div>
          <div>
            ended:{" "}
            {prompt.endedAt
              ? new Date(prompt.endedAt).toLocaleTimeString()
              : "—"}
          </div>
          <div>input: {fmtTokens(prompt.usage.inputTokens)}</div>
          <div>output: {fmtTokens(prompt.usage.outputTokens)}</div>
          <div>cache read: {fmtTokens(prompt.usage.cacheReadInputTokens)}</div>
          <div>
            cache write: {fmtTokens(prompt.usage.cacheCreationInputTokens)}
          </div>
        </div>
      )}
    </li>
  );
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });
}

function fmtTokens(n: number): string {
  return n.toLocaleString("en-US");
}
