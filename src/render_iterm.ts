import { encodeITerm2 } from "@earendil-works/pi-tui";
import { BaseImageRenderer } from "./render_image.js";
import type { ImageDims } from "./render_image.js";

/**
 * iTerm2 inline image protocol renderer.
 */
export class ITermRenderer extends BaseImageRenderer {
  constructor(size: number) {
    super(size);
  }

  protected encode(base64: string, _dims: ImageDims, _rows: number): string | null {
    return encodeITerm2(base64, {
      width: this.size,
      height: "auto",
      preserveAspectRatio: true,
    });
  }

  dispose() {
    // iTerm2 has no explicit image deletion mechanism
    this.currentFrame = null;
  }
}
