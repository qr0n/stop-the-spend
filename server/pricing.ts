export type TurnUsage = {
  inputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  outputTokens: number;
};

type ModelPrices = {
  input: number;        // USD per 1M tokens
  output: number;
  cacheRead: number;
  cacheWrite5m: number; // 5-minute ephemeral cache write rate (Claude Code default)
};

// Anthropic-published Claude prices. OpenRouter routes these models at the
// same rates (no markup on Anthropic models in OR's standard tier).
// 1m-context variants are 2x input/output per Anthropic's pricing.
const PRICES: Record<string, ModelPrices> = {
  "claude-opus-4-7":      { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite5m: 18.75 },
  "claude-opus-4-7-1m":   { input: 30,   output: 150,  cacheRead: 3.0,  cacheWrite5m: 37.5  },
  "claude-opus-4-6":      { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite5m: 18.75 },
  "claude-opus-4-5":      { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite5m: 18.75 },
  "claude-opus-4":        { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite5m: 18.75 },
  "claude-sonnet-4-6":    { input: 3,    output: 15,   cacheRead: 0.30, cacheWrite5m: 3.75  },
  "claude-sonnet-4-6-1m": { input: 6,    output: 30,   cacheRead: 0.60, cacheWrite5m: 7.5   },
  "claude-sonnet-4-5":    { input: 3,    output: 15,   cacheRead: 0.30, cacheWrite5m: 3.75  },
  "claude-sonnet-4":      { input: 3,    output: 15,   cacheRead: 0.30, cacheWrite5m: 3.75  },
  "claude-haiku-4-5":     { input: 0.80, output: 4,    cacheRead: 0.08, cacheWrite5m: 1     },
  "claude-haiku-4":       { input: 0.80, output: 4,    cacheRead: 0.08, cacheWrite5m: 1     },
};

const FAMILY_DEFAULTS: Record<string, ModelPrices> = {
  opus:   PRICES["claude-opus-4-7"]!,
  sonnet: PRICES["claude-sonnet-4-6"]!,
  haiku:  PRICES["claude-haiku-4-5"]!,
};

const warned = new Set<string>();

function normalize(model: string): string {
  return model
    .toLowerCase()
    .replace(/^anthropic\//, "")
    .replace(/[\[\(](\w+)[\]\)]/g, "-$1") // [1m]/(1m) → -1m
    .replace(/@(\w+)/g, "-$1")             // @1m → -1m
    .replace(/-\d{8}$/, "");               // drop date suffix like -20250219
}

function lookup(model: string): ModelPrices {
  const key = normalize(model);
  const exact = PRICES[key];
  if (exact) return exact;

  for (const family of Object.keys(FAMILY_DEFAULTS)) {
    if (key.includes(family)) {
      if (!warned.has(key)) {
        console.warn(
          `[pricing] no exact entry for "${model}" (key="${key}"); using ${family} defaults`
        );
        warned.add(key);
      }
      return FAMILY_DEFAULTS[family]!;
    }
  }

  if (!warned.has(key)) {
    console.warn(`[pricing] unknown model "${model}" (key="${key}"); cost = $0`);
    warned.add(key);
  }
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0 };
}

export function priceTurn(model: string, usage: TurnUsage): number {
  const p = lookup(model);
  const M = 1_000_000;
  return (
    (usage.inputTokens * p.input) / M +
    (usage.outputTokens * p.output) / M +
    (usage.cacheReadInputTokens * p.cacheRead) / M +
    (usage.cacheCreationInputTokens * p.cacheWrite5m) / M
  );
}
