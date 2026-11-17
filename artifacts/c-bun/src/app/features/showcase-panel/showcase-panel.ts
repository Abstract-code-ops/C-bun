import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SetRecorder } from '../../core/set-recorder';
import { Showcase } from '../../core/showcase';

@Component({
  selector: 'app-showcase-panel',
  imports: [MatCardModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatSlideToggleModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-content class="stack">
        <div class="head">
          <mat-icon>movie</mat-icon>
          <div>
            <strong>Showcase video</strong>
            <span>Camera, skeleton, graph and rep count in one clip.</span>
          </div>
        </div>

        @if (!sc.supported) {
          <p class="note">This browser can't record video from a canvas.</p>
        } @else {
          <mat-slide-toggle [checked]="sc.enabled()" [disabled]="busy()"
              (change)="sc.enabled.set($event.checked)">Record the next set</mat-slide-toggle>

          @if (sc.enabled()) {
            <mat-button-toggle-group class="full" [value]="sc.layout()" [disabled]="busy()"
                (change)="sc.layout.set($event.value)" aria-label="Layout">
              <mat-button-toggle value="stack">Stacked 4:5</mat-button-toggle>
              <mat-button-toggle value="side">Side by side 16:9</mat-button-toggle>
            </mat-button-toggle-group>
            <mat-button-toggle-group class="full" [value]="sc.quality()" [disabled]="busy()"
                (change)="sc.quality.set($event.value)" aria-label="Quality">
              <mat-button-toggle value="hd">720p</mat-button-toggle>
              <mat-button-toggle value="fhd">1080p</mat-button-toggle>
            </mat-button-toggle-group>
            <p class="note">Prop the phone up and step back so your whole body is in frame, then start a set.</p>
          }
        }

        @if (sc.phase() === 'live') { <p class="rec"><span class="dot"></span> Recording…</p> }
        @if (sc.phase() === 'outro') { <p class="rec">Finishing video…</p> }
        @if (sc.error(); as e) { <p class="err">{{ e }}</p> }

        @if (sc.result(); as r) {
          <video [src]="r.url" controls playsinline muted preload="metadata"></video>
          <p class="note">{{ r.durationSec }} s · {{ r.sizeMb }} MB · {{ r.ext.toUpperCase() }}</p>
          <div class="actions">
            <button mat-flat-button (click)="sc.share()"><mat-icon>ios_share</mat-icon> Save / share</button>
            <button mat-stroked-button (click)="sc.download()"><mat-icon>download</mat-icon> Download</button>
            <button mat-stroked-button (click)="sc.clear()"><mat-icon>delete</mat-icon> Delete</button>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host { display: block; margin-top: 16px; }
    .stack { display: flex; flex-direction: column; gap: 12px; padding-top: 16px; }
    .head { display: flex; gap: 12px; align-items: center; }
    .head div { display: flex; flex-direction: column; }
    .head span { font-size: 12px; opacity: .7; }
    .head mat-icon { color: var(--mat-sys-primary, #00e5a0); }
    .full { width: 100%; display: flex; }
    mat-button-toggle { flex: 1; }
    .note { margin: 0; font-size: 13px; opacity: .75; }
    .err { margin: 0; color: var(--mat-sys-error, #ff6b6b); }
    .rec { margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff4d4d; animation: pulse 1s infinite; }
    @keyframes pulse { 50% { opacity: .25; } }
    video { width: 100%; max-height: 420px; border-radius: 12px; background: #000; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions button { flex: 1; }
  `,
})
export class ShowcasePanel {
  protected readonly sc = inject(Showcase);
  private readonly rec = inject(SetRecorder);
  protected readonly busy = computed(() => this.sc.phase() !== 'off' || this.rec.state() !== 'idle');
}