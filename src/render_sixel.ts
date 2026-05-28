import { PNG } from "pngjs";
import { image2sixel } from "sixel";
import { BaseImageRenderer } from "./render_image.js";
import type { ImageDims } from "./render_image.js";
import { log } from "./log.js";

/**
 * SIXEL image protocol renderer.
 *
 * Uses node-sixel (https://github.com/jerch/node-sixel) for encoding.
 * Flow: base64 PNG → decode PNG → RGBA pixels → image2sixel() → SIXEL string
 *
 * Supports: Windows Terminal 1.22+, VSCode 1.101+, mlterm, Y生化term, Mintty, etc.
 */
export class SixelRenderer extends BaseImageRenderer {
  protected cursorAdvances = false;
  protected padMode: "spaces" | "skip" = "skip";

  constructor(size: number) {
    super(size);
  }

  protected encode(base64: string, dims: ImageDims, rows: number, yOffset: number): string | null {
    try {
      // 1. Decode base64 → PNG buffer
      const pngBuffer = Buffer.from(base64, "base64");

      // 2. Parse PNG to get RGBA pixel data
      const png = PNG.sync.read(pngBuffer);
      const { width, height, data: rgba } = png;

      // 3. Encode RGBA → SIXEL (returns complete sequence: introducer + data + finalizer)
      const sixelData = new Uint8ClampedArray(rgba);
      const sixelStr = image2sixel(sixelData, width, height, 256, 0);

      if (!sixelStr) {
        log(`SixelRenderer.encode: image2sixel returned empty string`);
        return null;
      }

      // 4. Apply vertical offset via cursor positioning
      // yOffset > 0 means we need to show the image starting yOffset pixels down
      // Strategy: move cursor down, emit SIXEL, move cursor back up
      let sequence: string;
      if (yOffset > 0) {
        const cursorDown = `\x1b[${yOffset}B`;
        const cursorUp = `\x1b[${yOffset}A`;
        sequence = cursorDown + sixelStr + cursorUp;
      } else {
        sequence = sixelStr;
      }

      log(`SixelRenderer.encode: seq len=${sequence.length}, dims=${width}x${height}, rows=${rows}, yOffset=${yOffset}`);
      return sequence;
    } catch (err) {
      log(`SixelRenderer.encode: error=${err}`);
      return null;
    }
  }

  dispose(): void {
    this.currentFrame = null;
  }
}
