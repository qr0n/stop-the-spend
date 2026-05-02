import { useEffect, useState } from "react";
import {
  clearSessions,
  fetchSession,
  fetchSessions,
  type Session,
  type SessionSummary,
} from "./api";
import { SessionDetail } from "./SessionDetail";
import { SessionList } from "./SessionList";

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const list = await fetchSessions();
        if (!alive) return;
        setSessions(list);
        setError(null);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const s = await fetchSession(selectedId);
        if (alive) setSelected(s);
      } catch {
        // soft
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [selectedId]);

  async function handleClear() {
    setClearing(true);
    try {
      await clearSessions();
      setSessions([]);
      setSelectedId(null);
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="page">
      <header className="top">
        <h1>stop the spend</h1>
        <p className="sub">
          per-prompt token spend, read straight from Claude Code transcripts
        </p>
      </header>
      <main className="grid">
        <SessionList
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <SessionDetail session={selected} />
      </main>
      <footer>
        <span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
        <button className="clear-btn" onClick={handleClear} disabled={clearing}>
          {clearing ? "clearing…" : "clear"}
        </button>
        {error && <span className="err">error: {error}</span>}
      </footer>
    </div>
  );
}
