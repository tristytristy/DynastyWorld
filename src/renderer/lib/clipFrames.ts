/**
 * Filmstrip capture for the live engine — the stills that let the model
 * actually watch an upload. Shared by DynastyTube (comment generation) and
 * the Media editor (auto-caption). One frame roughly every 2 seconds, 6-16
 * total, evenly spaced across 5%..95% of the clip; images send themselves.
 */

export function fileUrlOf(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
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

export async function captureClipFrames(absolutePath: string, mediaType: 'image' | 'video'): Promise<string[]> {
  const url = fileUrlOf(absolutePath);
  if (mediaType === 'image') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const frame = drawFrame(img, img.naturalWidth, img.naturalHeight);
        resolve(frame ? [frame] : []);
      };
      img.onerror = () => resolve([]);
      img.src = url;
    });
  }
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    const frames: string[] = [];
    const fail = window.setTimeout(() => resolve(frames), 45000);
    video.onerror = () => {
      window.clearTimeout(fail);
      resolve(frames);
    };
    video.onloadedmetadata = () => {
      const frameCount = Math.max(6, Math.min(16, Math.round(video.duration / 2)));
      const points = Array.from({ length: frameCount }, (_, i) =>
        video.duration * (0.05 + (0.9 * i) / Math.max(1, frameCount - 1)),
      );
      let at = 0;
      video.onseeked = () => {
        const frame = drawFrame(video, video.videoWidth, video.videoHeight);
        if (frame) frames.push(frame);
        at += 1;
        if (at < points.length) video.currentTime = points[at];
        else {
          window.clearTimeout(fail);
          resolve(frames);
        }
      };
      video.currentTime = points[0];
    };
    video.src = url;
  });
}
