import { Service, signal } from "@angular/core";

export type CameraFacing = 'user' | 'environment'

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'switching'
  | 'error'

export interface CameraState {
  status: CameraStatus;
  facing: CameraFacing;
  deviceId: string | null;
  width: number | null;
  height: number | null;
  error: string | null;
}

export interface CameraConfig {
  facing?: CameraFacing;
  width?: number;
  height?: number;
  framerate?: number;
}

const DEFAULT_CONFIG: Required<CameraConfig> = {
  facing: 'environment',
  width: 640,
  height: 480,
  framerate: 30
};

@Service()
export class Camera {

  private stream: MediaStream | null = null;
  private activeTrack: MediaStreamTrack | null = null;
  private operationId = 0;
  private config = {...DEFAULT_CONFIG};
  private readonly _state = signal<CameraState>({
    status: 'idle',
    facing: DEFAULT_CONFIG.facing,
    deviceId: null,
    width: null,
    height: null,
    error: null
  });
  readonly state = this._state.asReadonly();

  isSupported(): boolean {
    return(
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    );
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.activeTrack;
  }

  async start(config: CameraConfig = {}): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new Error('Camera API is not supported');
    }
    if (this.stream?.active) {
      return this.stream;
    }
    const operation = ++this.operationId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._state.update(state => ({
      ...state,
      status: 'requesting',
      facing: this.config.facing,
      error: null
    }));

    try {
       const stream= await navigator.mediaDevices.getUserMedia({
         audio: false,
         video: {
           facingMode: {
             ideal: this.config.facing
           },
           width: {
             ideal: this.config.width
           },
           height: {
             ideal: this.config.height
           },
           frameRate: {
             ideal: this.config.framerate,
             max: 30
           },
         },
       });
      // Ignore stale camera requests
      if (operation !== this.operationId) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("Camera request cancelled");
      }
      this.stream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) {
        this.releaseStream();
        throw new Error("No video track available");
      }
      this.activeTrack = track;
      const settings = track.getSettings();
      const facing = (settings.facingMode as CameraFacing) ?? this.config.facing;
      track.addEventListener('ended', this.handleTrackEnded);
      this._state.set({
        status: 'streaming',
        facing: facing,
        deviceId: settings.deviceId ?? null,
        width: settings.width ?? null,
        height: settings.height ?? null,
        error: null,
      });
      return stream;
    } catch (error) {
       if (operation === this.operationId) {
         this.releaseStream();
         this._state.update(state => ({
           ...state,
           status: 'error',
           error: this.getErrorMessage(error)
         }));
       }
      throw error;
    }
  }

  async switchCamera(): Promise<MediaStream>{
    const nextFacing: CameraFacing = this.config.facing === 'environment' ? 'user' : 'environment';
    this._state.update(state => ({
      ...state,
      status: 'switching',
      error: null,
    }));

    this.operationId++;
    
    // release existing camera
    this.releaseStream();

    return this.start({
      ...this.config,
      facing: nextFacing,
    });
  }

  stop(): void {
    ++this.operationId;
    this.releaseStream();
    this._state.update(state => ({
      ...state,
      status: 'idle',
      deviceId: null,
      width: null,
      height: null,
      error: null,
    }));
  }

  private releaseStream(): void {
    if (this.activeTrack) {
      this.activeTrack.removeEventListener(
        'ended',
        this.handleTrackEnded
      );
    }
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.activeTrack = null
  }

  private handleTrackEnded = (): void => {
    this.releaseStream();
    this._state.update(state => ({
      ...state,
      status: 'error',
      deviceId: null,
      width: null,
      height: null,
      error: 'Camera stream ended unexpectedly.',
    }));
  };

  private getErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          return 'Camera permission denied.';
        case 'NotFoundError':
          return 'No camera found on this device.';
        case 'NotReadableError':
          return 'Camera is being used by another application.';
        case 'OverconstrainedError':
          return 'Requested camera settings are unavailable.';
        case 'SecurityError':
          return 'Camera access is blocked by browser security.';
      }
    }
    return error instanceof Error
      ? error.message
      : 'Unknown camera error.';
  }
}
