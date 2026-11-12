/** Exponential moving average. Lower alpha = smoother but laggier. */
export class Ema {
  private value: number | null = null;
  constructor(private readonly alpha = 0.4) {}
  next(x: number): number {
    this.value = this.value === null ? x : this.value + this.alpha * (x - this.value);
    return this.value;
  }
  reset(): void { this.value = null; }
}
