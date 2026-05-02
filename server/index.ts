import "dotenv/config";
import express from "express";
import {
  getActiveSessionId,
  getSession,
  listSummaries,
  setClearedAt,
} from "./aggregator";
import {
  applySwap,
  recoverFromPriorCrash,
  revertSwap,
  SETTINGS_PATH,
} from "./settings-swap";
import { bootstrapAndWatch } from "./transcripts";

const apiKey = process.env.OPENROUTER_API_KEY;
const PORT = Number(process.env.PORT ?? 3001);

// Apply the OpenRouter swap only if a key is provided. Without it, the
// dashboard still works — transcripts measure spend regardless of routing —
// but Claude Code traffic won't be funneled through OpenRouter.
let swapApplied = false;
if (apiKey) {
  if (recoverFromPriorCrash()) {
    console.log(`[swap] recovered ${SETTINGS_PATH} from a prior crashed run`);
  }
  applySwap(apiKey);
  swapApplied = true;
  console.log(
    `[swap] ${SETTINGS_PATH} patched to OpenRouter — restart any open 'claude' sessions to pick up the change. Settings will be restored on shutdown.`
  );
} else {
  console.log(
    `[swap] OPENROUTER_API_KEY not set; skipping settings.json patch. Transcripts still measure spend.`
  );
}

let reverted = false;
function shutdown(reason: string) {
  if (reverted) return;
  reverted = true;
  if (swapApplied) {
    try {
      revertSwap();
      console.log(`[swap] settings.json restored (${reason})`);
    } catch (err) {
      console.error(`[swap] revert failed (${reason}):`, err);
    }
  }
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));
process.on("uncaughtException", (err) => {
  console.error("[uncaught]", err);
  shutdown("uncaughtException");
});

bootstrapAndWatch().catch((err) =>
  console.error(`[transcripts] bootstrap failed:`, err)
);

const app = express();
app.use(express.json());

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: listSummaries() });
});

app.get("/api/sessions/:id", (req, res) => {
  const s = getSession(req.params.id);
  if (!s) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  res.json({ session: s });
});

app.get("/api/active", (_req, res) => {
  res.json({ activeSessionId: getActiveSessionId() });
});

app.post("/api/clear", (_req, res) => {
  setClearedAt(new Date().toISOString());
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`stop-the-spend server on http://localhost:${PORT}`);
});
