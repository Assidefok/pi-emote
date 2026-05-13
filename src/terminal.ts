import { getCapabilities } from "@earendil-works/pi-tui";
import type { TerminalMapping } from "./types.js";
import { log } from "./log.js";

type RenderKind = "kitty" | "iterm2" | "ascii";

/**
 * Detect the terminal or multiplexer name from environment variables.
 * Multiplexers are checked first — they set vars that leak through from
 * the outer terminal emulator.
 */
export function detectTerminalName(): string {
  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase();
  const term = (process.env.TERM ?? "").toLowerCase();

  // --- Multiplexers (checked first) ---
  if (process.env.ZELLIJ_SESSION_NAME || process.env.ZELLIJ) return "zellij";
  if (process.env.TMUX || term.startsWith("tmux")) return "tmux";
  if (term.startsWith("screen")) return "screen";

  // --- Terminal emulators ---
  if (process.env.KITTY_WINDOW_ID || termProgram === "kitty") return "kitty";
  if (process.env.GHOSTTY_RESOURCES_DIR || termProgram === "ghostty" || term.includes("ghostty")) return "ghostty";
  if (process.env.WEZTERM_PANE || termProgram === "wezterm") return "wezterm";
  if (process.env.ITERM_SESSION_ID || termProgram === "iterm.app") return "iterm2";
  if (termProgram === "vscode") return "vscode";
  if (termProgram === "alacritty") return "alacritty";

  return "unknown";
}

/**
 * Resolve which renderer to use.
 *
 * 1. Detect terminal name from env vars.
 * 2. Look up in the terminals whitelist — if matched, use its render value.
 * 3. No match — fall back to pi-tui's getCapabilities().images.
 *
 * Returns "kitty" | "iterm2" | "ascii".
 */
export function resolveRenderer(terminals: TerminalMapping[]): RenderKind {
  const name = detectTerminalName();
  log(`terminal: detected "${name}"`);

  for (const entry of terminals) {
    if (entry.match === name) {
      log(`terminal: whitelist match "${name}" → render "${entry.render}"`);
      return entry.render;
    }
  }

  // No whitelist match — fall back to pi-tui capabilities
  const caps = getCapabilities();
  const fallback: RenderKind = caps.images ?? "ascii";
  log(`terminal: no whitelist match for "${name}", using pi-tui capabilities → "${fallback}"`);
  return fallback;
}
