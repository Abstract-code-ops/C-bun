export interface Point3 { x: number; y: number; z?: number; visibility?: number }

/** Angle in degrees at point b, formed by a-b-c. Works in 2D or 3D. */
export function angleDeg(a: Point3, b: Point3, c: Point3): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
  if (mag === 0) return NaN;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}
