# stop the spend

Per-prompt token-spend dashboard for Claude Code. Reads Claude Code's own
session transcripts at `~/.claude/projects/<sanitized-cwd>/<session-uuid>.jsonl`,
groups assistant turns into prompt cycles (one user message → all the turns it
triggered), multiplies tokens by a model price table, and serves a session list
+ per-prompt drill-down.

No proxy. Works regardless of where Claude Code routes (Anthropic direct,
OpenRouter, custom proxy). The OpenRouter "swap" from v1 is still here as an
optional convenience — if `OPENROUTER_API_KEY` is set in `.env`, the dashboard
patches `~/.claude/settings.json` on boot to route Claude Code through
OpenRouter, and reverts on shutdown. Skip the key, skip the patch.

## Setup

```bash
cp .env.example .env
# OPENROUTER_API_KEY is optional now. Set it to also route through OpenRouter.

npm install
npm run dev
```

Backend on `:3001`, Vite on `:5173`. Open <http://localhost:5173>. Existing
transcripts on disk show up immediately.

## Using it

1. `npm run dev` in this project — leave it running.
2. Open another terminal: `cd` into wherever you want to do real work, run `claude`.
3. Send one prompt. Wait for the loop to finish.
4. Within ~1–2 seconds, a new session appears at the top of the list with a
   green "live" dot. Click it: see the prompt's tokens (input / output / cache
   read / cache write) and computed cost.
5. Run a different `claude` in a different shell, send another prompt — second
   session appears alongside the first with its own independent cost.

For the manager screenshot: each prompt is its own row with its own cost — you
can show "this one feature took $X" without confounding traffic.

## OpenRouter swap (optional)

When `OPENROUTER_API_KEY` is set, dashboard startup:

1. Reads `~/.claude/settings.json`, backs it up to
   `~/.claude/settings.json.stop-the-spend.bak`.
2. Patches the `env` block:
   ```json
   "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
   "ANTHROPIC_AUTH_TOKEN": "<your OpenRouter key>",
   "ANTHROPIC_API_KEY": ""
   ```
3. On Ctrl+C / SIGTERM / uncaughtException, restores the backup. If the
   dashboard crashed previously and left an orphan backup, the next start
   detects it and restores before applying a fresh swap.

The empty `ANTHROPIC_API_KEY` is required: a non-empty value silently
overrides `ANTHROPIC_AUTH_TOKEN` and Claude Code goes straight to Anthropic.

A `claude` session that was already running before the dashboard started
keeps using whatever endpoint it loaded at startup — quit and relaunch any
open `claude` to pick up the swap. Verify with `/status` inside Claude Code;
base URL should show `https://openrouter.ai/api`.

## Pricing

Hardcoded in `server/pricing.ts`. Anthropic-published rates for Claude
Opus / Sonnet / Haiku 4.x families, with explicit entries for the 1m-context
variants (priced at 2× input/output per Anthropic's pricing page). Unknown
models log a one-time warning and contribute $0 to the cost.

To update rates or add models, edit the `PRICES` map. Cost recomputes on the
fly from raw token counts; no historical data needs migrating.

## Files

- `server/index.ts` — Express, swap lifecycle, API endpoints
- `server/transcripts.ts` — chokidar watcher + JSONL parser
- `server/aggregator.ts` — in-memory Session/Prompt state
- `server/pricing.ts` — model price table + cost calculation
- `server/settings-swap.ts` — patches/reverts `~/.claude/settings.json`
- `src/App.tsx` — split-pane layout, polling
- `src/SessionList.tsx` — left pane
- `src/SessionDetail.tsx` — right pane with prompt drill-down

## Troubleshooting

**No sessions appear.** Confirm `~/.claude/projects/` exists and has at least
one `.jsonl` file. The dashboard logs `[transcripts] initial scan: N jsonl
files` at boot.

**A session is missing from the list.** Sidechain (subagent) transcripts are
filtered out to avoid double-counting. If you genuinely have a session that
isn't a sidechain and isn't appearing, check `[transcripts]` log lines for
file-read errors.

**Cost shows $0 for some prompts.** That model isn't in the price table — see
the boot log for `[pricing] unknown model …` warnings and add the entry to
`server/pricing.ts`.

**`claude` keeps going to Anthropic instead of OpenRouter.** Either you have
a `claude` session that started before the dashboard, or `ANTHROPIC_API_KEY`
is set to a non-empty value somewhere (overrides everything). `/status`
inside Claude Code is the source of truth.

**Backup file left behind after a crash.** Next `npm run dev` auto-recovers.
Manual revert: `mv ~/.claude/settings.json.stop-the-spend.bak ~/.claude/settings.json`.
