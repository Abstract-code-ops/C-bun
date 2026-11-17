import { Rect } from '../utils/canvas-kit';

export type ShowcaseLayoutKind = 'stack' | 'side';
export type ShowcaseQuality = 'hd' | 'fhd';

/** Rectangles are in "design units"; everything is scaled to the output size. */
export interface LayoutDef {
  w: number; h: number;
  header: Rect; camera: Rect; counter: Rect; graph: Rect; footer: Rect;
}

const STACK: LayoutDef = {
  w: 1080, h: 1350,
  header:  { x: 24, y: 0,    w: 1032, h: 100 },
  camera:  { x: 24, y: 108,  w: 1032, h: 744 },
  counter: { x: 24, y: 864,  w: 1032, h: 140 },
  graph:   { x: 24, y: 1016, w: 1032, h: 272 },
  footer:  { x: 24, y: 1296, w: 1032, h: 54 },
};

const SIDE: LayoutDef = {
  w: 1920, h: 1080,
  header:  { x: 32,   y: 0,   w: 1856, h: 84 },
  camera:  { x: 32,   y: 92,  w: 1100, h: 880 },
  counter: { x: 1164, y: 92,  w: 724,  h: 250 },
  graph:   { x: 1164, y: 358, w: 724,  h: 614 },
  footer:  { x: 32,   y: 984, w: 1856, h: 64 },
};

export const layoutFor = (k: ShowcaseLayoutKind): LayoutDef => (k === 'stack' ? STACK : SIDE);

export function dimsFor(k: ShowcaseLayoutKind, q: ShowcaseQuality): { w: number; h: number } {
  if (k === 'stack') return q === 'hd' ? { w: 720, h: 900 } : { w: 1080, h: 1350 };
  return q === 'hd' ? { w: 1280, h: 720 } : { w: 1920, h: 1080 };
}

export const BITRATE: Record<ShowcaseLayoutKind, Record<ShowcaseQuality, number>> = {
  stack: { hd: 5_000_000, fhd: 10_000_000 },
  side:  { hd: 6_000_000, fhd: 12_000_000 },
};