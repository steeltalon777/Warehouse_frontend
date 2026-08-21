/* Minimal ambient types for pngjs (no @types/pngjs installed) */
declare module 'pngjs' {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(opts: { width: number; height: number });
    static sync read(buf: Buffer): PNG;
  }
  export namespace PNG {
    function sync_read(buf: Buffer): PNG;
  }
}
declare module 'pixelmatch' {
  function default_(
    img1: Buffer | Uint8Array,
    img2: Buffer | Uint8Array,
    output: Buffer | Uint8Array,
    width: number,
    height: number,
    options?: { threshold?: number; includeAA?: boolean; alpha?: number; aaColor?: [number, number, number]; diffColor?: [number, number, number] },
  ): number;
  export default default_;
}
