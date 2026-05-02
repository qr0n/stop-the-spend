import chokidar from "chokidar";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyEvent, resetState } from "./aggregator";

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

type FileState = {
  offset: number;
  partial: string;
};
const fileState = new Map<string, FileState>();

function deriveSessionId(filePath: string): string {
  return path.basename(filePath, ".jsonl");
}

function deriveCwd(filePath: string): string {
  // ~/.claude/projects/<sanitized-cwd>/<uuid>.jsonl — sanitized form replaces / with -
  const dir = path.basename(path.dirname(filePath));
  return dir.startsWith("-") ? dir.replace(/-/g, "/") : dir;
}

async function ingestFromOffset(filePath: string) {
  const sessionId = deriveSessionId(filePath);
  const cwd = deriveCwd(filePath);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return; // file gone
  }

  const prev = fileState.get(filePath) ?? { offset: 0, partial: "" };
  if (stat.size <= prev.offset) {
    // file shrank (truncated/replaced) — reset and read whole
    fileState.set(filePath, { offset: 0, partial: "" });
    return ingestFromOffset(filePath);
  }
  if (stat.size === prev.offset) return;

  const stream = fs.createReadStream(filePath, {
    start: prev.offset,
    end: stat.size - 1,
    encoding: "utf8",
  });

  let buf = prev.partial;
  for await (const chunk of stream) buf += chunk;

  const lines = buf.split("\n");
  const trailing = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      applyEvent(JSON.parse(line), sessionId, cwd);
    } catch {
      // skip malformed
    }
  }
  fileState.set(filePath, { offset: stat.size, partial: trailing });
}

function listAllTranscripts(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(PROJECTS_DIR, entry.name);
    let inner: fs.Dirent[];
    try {
      inner = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const f of inner) {
      if (f.isFile() && f.name.endsWith(".jsonl")) {
        out.push(path.join(dir, f.name));
      }
    }
  }
  return out;
}

export async function bootstrapAndWatch(): Promise<void> {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.warn(`[transcripts] ${PROJECTS_DIR} does not exist; nothing to watch`);
    return;
  }

  resetState();
  fileState.clear();

  const files = listAllTranscripts();
  console.log(`[transcripts] initial scan: ${files.length} jsonl files`);
  for (const f of files) {
    try {
      await ingestFromOffset(f);
    } catch (err) {
      console.error(`[transcripts] ingest ${f}: ${(err as Error).message}`);
    }
  }
  console.log(`[transcripts] initial scan complete`);

  const watcher = chokidar.watch(PROJECTS_DIR, {
    persistent: true,
    ignoreInitial: true,
    depth: 2,
  });

  const handle = (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    ingestFromOffset(filePath).catch((err) =>
      console.error(`[transcripts] watch-ingest ${filePath}: ${err}`)
    );
  };

  watcher.on("add", handle);
  watcher.on("change", handle);
  watcher.on("error", (err) => console.error(`[transcripts] watcher error:`, err));
}
