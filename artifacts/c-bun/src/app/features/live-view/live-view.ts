import {
  Component, ElementRef, NgZone, OnDestroy,
  computed, inject, signal, viewChild,
} from '@angular/core';
import { DrawingUtils, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Camera } from '../../core/camera';
import { Pose } from '../../core/pose';

@Component({
  selector: 'app-live-view',
  templateUrl: './live-view.html',
  styleUrl: './live-view.css',
})
export class LiveView implements OnDestroy {
  private readonly camera = inject(Camera);
  private readonly pose = inject(Pose);
  private readonly zone = inject(NgZone);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly cam = this.camera.state;
  readonly poseStatus = this.pose.status;
  readonly poseError = this.pose.error;

  readonly fps = signal(0);
  readonly detected = signal(false);
  readonly ratio = signal('4 / 3');
  readonly running = signal(false);

  readonly mirrored = computed(() => this.cam().facing === 'user');
  readonly busy = computed(() =>
    ['requesting', 'switching'].includes(this.cam().status) ||
    this.poseStatus() === 'loading');
  readonly errorMsg = computed(() => this.cam().error ?? this.poseError());

  private raf = 0;
  private lastVideoTime = -1;
  private drawer: DrawingUtils | null = null;

  async start(): Promise<void> {
    if (this.running()) return;
    try {
      const [stream] = await Promise.all([this.camera.start(), this.pose.init()]);
      await this.attach(stream);
      this.running.set(true);
      this.runLoop();
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // cancelled, ignore
      this.teardown(); // errors are already in camera/pose state signals
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.running()) return;
    try {
      const stream = await this.camera.switchCamera();
      await this.attach(stream);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      this.teardown();
    }
  }

  stop(): void {
    this.camera.stop();
    this.teardown();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  // ---------- internals ----------

  private async attach(stream: MediaStream): Promise<void> {
    const video = this.videoRef().nativeElement;
    const canvas = this.canvasRef().nativeElement;
    video.muted = true; // set in code: Angular's `muted` attribute is unreliable
    video.srcObject = stream;
    await video.play();

    // Size from the real video, not from camera state (portrait can swap w/h)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    this.ratio.set(`${video.videoWidth} / ${video.videoHeight}`);
    this.drawer = new DrawingUtils(canvas.getContext('2d')!);
    this.lastVideoTime = -1;
  }

  private runLoop(): void {
    cancelAnimationFrame(this.raf);
    this.zone.runOutsideAngular(() => {
      const video = this.videoRef().nativeElement;
      let frames = 0;
      let windowStart = performance.now();

      const tick = () => {
        this.raf = requestAnimationFrame(tick);
        // Only process NEW video frames (detectForVideo needs increasing timestamps)
        if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
        this.lastVideoTime = video.currentTime;

        const now = performance.now();
        const result = this.pose.detect(video, now);
        this.draw(result);
        this.detected.set(!!result?.landmarks.length);

        frames++;
        if (now - windowStart >= 1000) {
          this.fps.set(frames);
          frames = 0;
          windowStart = now;
        }
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  private draw(result: PoseLandmarkerResult | null): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!result || !this.drawer) return;
    for (const lm of result.landmarks) {
      this.drawer.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
        color: '#00e5a0', lineWidth: 3,
      });
      this.drawer.drawLandmarks(lm, {
        color: '#ffffff', fillColor: '#ff4d4d', radius: 3,
      });
    }
  }

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.running.set(false);
    this.fps.set(0);
    this.detected.set(false);
    this.drawer = null;
    const video = this.videoRef().nativeElement;
    video.srcObject = null;
    const canvas = this.canvasRef().nativeElement;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

