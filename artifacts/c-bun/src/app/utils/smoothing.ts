/** Exponential smoothing by time constant, so it behaves the same at 25 and 60 FPS. */
export class Ema {
  private value: number | null = null;
  private lastT = 0;
  constructor(private readonly tauMs = 40) {}

  next(x: number, tMs: number): number {
    if (this.value === null) { this.value = x; this.lastT = tMs; return x; }
    const dt = Math.max(0, tMs - this.lastT);
    this.lastT = tMs;
    this.value += (1 - Math.exp(-dt / this.tauMs)) * (x - this.value);
    return this.value;
  }
  reset(): void { this.value = null; }
}
