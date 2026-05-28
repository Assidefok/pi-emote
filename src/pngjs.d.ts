// Type declarations for pngjs (v7 ships no .d.ts)
declare module "pngjs" {
  export class PNG {
    static readonly sync: {
      read(buffer: Buffer, options?: object): PNG;
      write(png: PNG, options?: object): Buffer;
    };
    width: number;
    height: number;
    data: Buffer; // RGBA as Buffer (Uint8Array compatible)
    constructor(options?: object);
  }
}
