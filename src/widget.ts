import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import type { Config } from "./types.js";
import type { Animator } from "./animator.js";
import type { RenderedFrame } from "./renderer.js";
import { log } from "./log.js";

// --- Token formatting ---

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1_000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

// --- Info panel ---

function buildInfoLines(width: number, config: Config, ctxRef: any, pi: any, theme: any): string[] {
  const lines: string[] = [];
  if (!ctxRef) return lines;

  const model = ctxRef.model;
  let modelStr = model?.name ?? "no model";
  const thinkingLevel = pi.getThinkingLevel?.() ?? "high";
  if (model?.reasoning) {
    modelStr += ` • ${thinkingLevel}`;
  }
  lines.push(theme.bold(modelStr));

  const usage = ctxRef.getContextUsage?.();
  if (usage) {
    const pct = usage.percent !== null ? `${usage.percent.toFixed(1)}%` : "?";
    const tokens = usage.tokens !== null ? formatTokens(usage.tokens) : "?";
    const window = formatTokens(usage.contextWindow);
    lines.push(`Context: ${tokens}/${window} (${pct})`);
  }

  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  try {
    for (const entry of ctxRef.sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message.role === "assistant") {
        totalInput += entry.message.usage?.input ?? 0;
        totalOutput += entry.message.usage?.output ?? 0;
        totalCost += entry.message.usage?.cost?.total ?? 0;
      }
    }
  } catch (_) { /* ignore if not available */ }

  if (totalInput || totalOutput) {
    lines.push(`↑${formatTokens(totalInput)} ↓${formatTokens(totalOutput)}`);
  }

  lines.push(`$${totalCost.toFixed(3)}`);

  const infoWidth = width - config.size - 5;
  return lines.map(l => {
    if (visibleWidth(l) > infoWidth) return truncateToWidth(l, infoWidth, "…");
    return l;
  });
}

// --- Render helpers ---

function renderImageFrame(frame: RenderedFrame & { kind: "image" }, width: number, config: Config, infoLines: string[], borderColor: (s: string) => string, theme: any): string[] {
  const sep = borderColor("│");
  const leftMargin = " ";
  const avatarPad = " ".repeat(config.size);
  const lines: string[] = [];

  for (let i = 0; i < frame.rows; i++) {
    let line = "";
    if (i === 0) {
      line = leftMargin + frame.sequence + `${avatarPad} ${sep} ${infoLines[i] ?? ""}`;
    } else {
      line = `${leftMargin}${avatarPad} ${sep} ${infoLines[i] ?? ""}`;
    }
    lines.push(line);
  }

  return lines;
}

function renderTextFrame(frame: RenderedFrame & { kind: "text" }, width: number, config: Config, infoLines: string[], borderColor: (s: string) => string, theme: any): string[] {
  const sep = borderColor("│");
  const leftMargin = " ";
  const avatarPad = " ".repeat(config.size);

  // Place emote text on the 3rd row (index 2), vertically centered in a
  // block tall enough to hold the info panel (min 4 rows to match image size).
  const emoteLines = frame.lines;
  const emoteRow = 2;
  const rowCount = Math.max(emoteRow + emoteLines.length, infoLines.length, 4);
  const lines: string[] = [];

  for (let i = 0; i < rowCount; i++) {
    const emoteIdx = i - emoteRow;
    const emote = (emoteIdx >= 0 && emoteIdx < emoteLines.length) ? emoteLines[emoteIdx] : "";
    const emoteWidth = visibleWidth(emote);
    // Center the emote within config.size columns
    const totalPad = config.size - emoteWidth;
    const padLeft = totalPad > 0 ? " ".repeat(Math.floor(totalPad / 2)) : "";
    const padRight = totalPad > 0 ? " ".repeat(Math.ceil(totalPad / 2)) : "";
    const cell = emote ? `${padLeft}${emote}${padRight}` : avatarPad;
    lines.push(`${leftMargin}${cell} ${sep} ${infoLines[i] ?? ""}`);
  }

  return lines;
}

// --- Widget factory ---

export interface WidgetDeps {
  animator: Animator;
  config: Config;
  pi: any;
  getCtxRef: () => any;
  getCurrentEmoteSet: () => string;
}

export function createWidgetFactory(deps: WidgetDeps) {
  return (_tui: any, theme: any) => {
    deps.animator.setTui(_tui);
    return {
      render(width: number): string[] {
        const { animator, config } = deps;

        if (width < config.hideBelow) return [];

        const frame = animator.getRenderedFrame();
        if (!frame) {
          log(`render: no frame`);
          return [];
        }

        log(`render: kind=${frame.kind}, set="${deps.getCurrentEmoteSet()}"`);

        const thinkingLevel = deps.pi.getThinkingLevel?.() ?? "high";
        const borderColor = (theme as any).getThinkingBorderColor?.(thinkingLevel)
          ?? ((s: string) => theme.fg("border", s));
        const border = borderColor("─".repeat(width));
        const infoLines = buildInfoLines(width, config, deps.getCtxRef(), deps.pi, theme);

        const lines: string[] = [];
        lines.push(border);

        if (frame.kind === "image") {
          lines.push(...renderImageFrame(frame, width, config, infoLines, borderColor, theme));
        } else {
          lines.push(...renderTextFrame(frame, width, config, infoLines, borderColor, theme));
        }

        return lines;
      },
      invalidate() {},
      dispose() {
        deps.animator.setTui(null);
      },
    };
  };
}
