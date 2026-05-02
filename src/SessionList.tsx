import type { SessionSummary } from "./api";

export function SessionList({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="session-list">
      <h2>Sessions</h2>
      {sessions.length === 0 ? (
        <div className="empty">no sessions yet — run `claude` somewhere</div>
      ) : (
        <ul>
          {sessions.map((s) => {
            const isLive =
              Date.now() - new Date(s.lastActivity).getTime() < 30_000;
            const isSelected = s.id === selectedId;
            return (
              <li
                key={s.id}
                className={`session-row${isSelected ? " selected" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                <div className="session-title">
                  {isLive && <span className="live-dot" />}
                  <span className="session-id">{s.id.slice(0, 8)}</span>
                  <span className="session-cwd">{cwdLabel(s.cwd)}</span>
                </div>
                <div className="session-meta">
                  <span>{s.promptCount} prompt{s.promptCount === 1 ? "" : "s"}</span>
                  <span className="cost">{fmtUsd(s.totalCostUsd)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function cwdLabel(cwd: string): string {
  return cwd.split("/").filter(Boolean).slice(-2).join("/") || cwd;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });
}
