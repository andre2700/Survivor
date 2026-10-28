/** Hash espacial reconstruído a cada frame para consultas de proximidade baratas. */
export interface Positioned {
  x: number;
  y: number;
}

export class SpatialGrid<T extends Positioned> {
  private cells = new Map<number, T[]>();
  private pool: T[][] = [];

  constructor(public readonly cellSize = 32) {}

  private key(cx: number, cy: number) {
    // combina duas coordenadas inteiras (até ±32768 células) num número único
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear() {
    for (const arr of this.cells.values()) {
      arr.length = 0;
      this.pool.push(arr);
    }
    this.cells.clear();
  }

  insert(item: T) {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let arr = this.cells.get(k);
    if (!arr) {
      arr = this.pool.pop() ?? [];
      this.cells.set(k, arr);
    }
    arr.push(item);
  }

  /** Chama `fn` para cada item nas células que cobrem o círculo (x, y, r). Retornar `true` interrompe. */
  query(x: number, y: number, r: number, fn: (item: T) => boolean | void) {
    const s = this.cellSize;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) if (fn(arr[i])) return;
      }
    }
  }
}
