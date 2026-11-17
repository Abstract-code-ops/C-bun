import { Service, signal } from '@angular/core';

const MODEL = '/mediapipe/pose_landmarker_lite.task';
const WASM = '/mediapipe/wasm/vision_wasm_internal.wasm';
const round1 = (x: number) => Math.round(x * 10) / 10;

@Service()
export class StorageInfo {
  readonly usedMb = signal<number | null>(null);
  readonly quotaMb = signal<number | null>(null);
  readonly persisted = signal<boolean | null>(null);
  readonly packReady = signal(false);

  async refresh(): Promise<void> {
    try {
      const est = await navigator.storage?.estimate?.();
      if (est) {
        this.usedMb.set(round1((est.usage ?? 0) / 1048576));
        this.quotaMb.set(Math.round((est.quota ?? 0) / 1048576));
      }
      this.persisted.set((await navigator.storage?.persisted?.()) ?? null);
    } catch { /* unsupported */ }
    try {
      const [m, w] = await Promise.all([caches.match(MODEL), caches.match(WASM)]);
      this.packReady.set(!!m && !!w);
    } catch {
      this.packReady.set(false);
    }
  }

  async requestPersist(): Promise<void> {
    try { this.persisted.set(await navigator.storage.persist()); } catch { /* unsupported */ }
  }
}