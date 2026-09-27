/**
 * Filmstrip capture for the live engine — the stills that let the model
 * actually watch an upload. Shared by DynastyTube (comment generation) and
 * the Media editor (auto-caption). One frame roughly every 2 seconds, 6-16
 * total, evenly spaced across 5%..95% of the clip; images send themselves.
 *
 * Alongside the frames we return WHERE in the clip each one was taken —
 * that's what lets a generated comment cite "0:47" and have the player
 * actually seek there (clickable timestamps, user pick 2026-09-19).
 */

export function fileUrlOf(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

export interface ClipFilm {
  frames: string[];
  /** Clip length in seconds — undefined for still images. */
  durationSeconds?: number;
  /** Seconds into the clip of each frame, same order as `frames`. */
  frameTimes?: number[];
}

const FRAME_WIDTH = 640;

function drawFrame(source: HTMLVideoElement | HTMLImageElement, width: number, height: number): string | null {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, FRAME_WIDTH / Math.max(1, width));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null; // canvas tainted or codec issue — callers proceed unseen
  }
}

export async function captureClipFilm(absolutePath: string, mediaType: 'image' | 'video'): Promise<ClipFilm> {
  const url = fileUrlOf(absolutePath);
  if (mediaType === 'image') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const frame = drawFrame(img, img.naturalWidth, img.naturalHeight);
        resolve({ frames: frame ? [frame] : [] });
      };
      img.onerror = () => resolve({ frames: [] });
      img.src = url;
    });
  }
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    const frames: string[] = [];
    const frameTimes: number[] = [];
    const finish = () => resolve({ frames, durationSeconds: video.duration || undefined, frameTimes });
    const fail = window.setTimeout(finish, 45000);
    video.onerror = () => {
      window.clearTimeout(fail);
      finish();
    };
    video.onloadedmetadata = () => {
      const frameCount = Math.max(6, Math.min(16, Math.round(video.duration / 2)));
      const points = Array.from({ length: frameCount }, (_, i) =>
        video.duration * (0.05 + (0.9 * i) / Math.max(1, frameCount - 1)),
      );
      let at = 0;
      video.onseeked = () => {
        const frame = drawFrame(video, video.videoWidth, video.videoHeight);
        if (frame) {
          frames.push(frame);
          frameTimes.push(points[at]);
        }
        at += 1;
        if (at < points.length) video.currentTime = points[at];
        else {
          window.clearTimeout(fail);
          finish();
        }
      };
      video.currentTime = points[0];
    };
    video.src = url;
  });
}

/** Frames-only capture — kept for callers that don't need timestamps. */
export async function captureClipFrames(absolutePath: string, mediaType: 'image' | 'video'): Promise<string[]> {
  return (await captureClipFilm(absolutePath, mediaType)).frames;
}
