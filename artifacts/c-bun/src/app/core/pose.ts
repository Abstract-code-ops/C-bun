import { Service, signal } from "@angular/core";
import { Subject } from 'rxjs';
import {
  FilesetResolver,
  PoseLandmarker,
  NormalizedLandmark,
  Landmark,
  PoseLandmarkerResult
} from '@mediapipe/tasks-vision';

const MP_VERSION = "1.2.3";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PoseFrame {
  timestamp: number;
  landmarks: NormalizedLandmark[]; // 2D, normalized 0..1 (for drawing)
  world: Landmark[];               // 3D, meters (better for angles in Phase 2)
}

@Service()
export class Pose {
  private landmarker: PoseLandmarker | null = null;
  private initPromise: Promise<void> | null = null;

  private readonly _status = signal<PoseStatus>('idle');
  readonly status = this._status.asReadonly();
  readonly error = signal<string | null>(null);

  private readonly _frame$ = new Subject<PoseFrame | null>();
  readonly frame$ = this._frame$.asObservable();

  /** Idempotent: safe to call many times. */
  init(): Promise<void> {
    if (this.landmarker) return Promise.resolve();
    this.initPromise ??= this.load();
    return this.initPromise;
  }

  private async load(): Promise<void> {
    this._status.set('loading');
    this.error.set(null);
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      try {
        this.landmarker = await this.create(fileset, 'GPU');
      } catch {
        this.landmarker = await this.create(fileset, 'CPU'); // fallback
      }
      this._status.set('ready');
    } catch (e) {
      this.initPromise = null; // allow retry
      this._status.set('error');
      this.error.set(e instanceof Error ? e.message : 'Failed to load pose model.');
      throw e;
    }
  }

  private create(
    fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    delegate: 'GPU' | 'CPU',
  ) {
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  /** Call once per NEW video frame. timestamp must strictly increase. */
  detect(video: HTMLVideoElement, timestamp: number): PoseLandmarkerResult | null {
    if (!this.landmarker) return null;
    const result = this.landmarker.detectForVideo(video, timestamp);
    const landmarks = result.landmarks[0];
    this._frame$.next(
      landmarks
        ? { timestamp, landmarks, world: result.worldLandmarks[0] ?? [] }
        : null,
    );
    return result;
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.initPromise = null;
    this._status.set('idle');
  }
}
