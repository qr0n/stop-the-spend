import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
export const BACKUP_PATH = path.join(
  os.homedir(),
  ".claude",
  "settings.json.stop-the-spend.bak"
);

const OPENROUTER_BASE = "https://openrouter.ai/api";

type Settings = {
  env?: Record<string, string>;
  [k: string]: unknown;
};

function stripLineComments(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");
}

function readSettings(): Settings {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  const text = fs.readFileSync(SETTINGS_PATH, "utf8");
  try {
    return JSON.parse(stripLineComments(text)) as Settings;
  } catch {
    throw new Error(
      `${SETTINGS_PATH} is not valid JSON; refusing to swap. Fix the file and retry.`
    );
  }
}

function writeSettings(s: Settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2) + "\n", "utf8");
}

export function recoverFromPriorCrash(): boolean {
  if (!fs.existsSync(BACKUP_PATH)) return false;
  const prior = fs.readFileSync(BACKUP_PATH, "utf8");
  fs.writeFileSync(SETTINGS_PATH, prior, "utf8");
  fs.unlinkSync(BACKUP_PATH);
  return true;
}

export function applySwap(openrouterKey: string) {
  const rawText = fs.existsSync(SETTINGS_PATH)
    ? fs.readFileSync(SETTINGS_PATH, "utf8")
    : "{}";
  fs.writeFileSync(BACKUP_PATH, rawText, "utf8");
  const original = readSettings();
  const swapped: Settings = {
    ...original,
    env: {
      ...(original.env ?? {}),
      ANTHROPIC_BASE_URL: OPENROUTER_BASE,
      ANTHROPIC_AUTH_TOKEN: openrouterKey,
      ANTHROPIC_API_KEY: "",
    },
  };
  writeSettings(swapped);
}

export function revertSwap() {
  if (!fs.existsSync(BACKUP_PATH)) return;
  const original = fs.readFileSync(BACKUP_PATH, "utf8");
  fs.writeFileSync(SETTINGS_PATH, original, "utf8");
  fs.unlinkSync(BACKUP_PATH);
}
