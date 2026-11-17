export interface Rect { x: number; y: number; w: number; h: number }

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, rad: number): void {
  const k = Math.min(rad, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

export interface TextOpts { weight?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxW?: number }

/** Draws text and returns its width. */
export function text(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
  size: number, color: string, o: TextOpts = {},
): number {
  ctx.font = `${o.weight ?? 600} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.maxW) ctx.fillText(s, x, y, o.maxW);
  else ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  return o.maxW ? Math.min(w, o.maxW) : w;
}

/** Rounded label whose text baseline sits at y. Returns its width. */
export function pill(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
  size: number, fg: string, bg: string, maxW?: number,
): number {
  ctx.font = `700 ${size}px ${FONT}`;
  const padX = size * 0.6;
  const tw = Math.min(ctx.measureText(s).width, maxW ? Math.max(10, maxW - padX * 2) : Infinity);
  const r: Rect = { x, y: y - size * 1.15, w: tw + padX * 2, h: size * 1.75 };
  roundRectPath(ctx, r, r.h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x + padX, y, tw);
  return r.w;
}