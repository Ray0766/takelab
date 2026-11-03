import type { Take } from "./model";
import { readMedia } from "./storage";

export const demoUrl = (name: string) =>
  `${import.meta.env.BASE_URL}demo/${name}`;
export async function sourceFor(
  take: Take,
): Promise<{ url: string; release: () => void } | null> {
  let blob = await readMedia(take.id);
  if (!blob && take.demo) {
    // Some static hosts ignore Range requests. Fetch the small bundled fixture
    // once per mounted player so demo seeking follows the same Blob path as imports.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(demoUrl(take.demo), {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Demo source unavailable: ${take.demo}`);
      blob = await response.blob();
    } finally {
      clearTimeout(timer);
    }
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
}
export function inspectVideo(
  file: File,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      clearTimeout(timer);
      video.onloadedmetadata = video.ontimeupdate = video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(`${file.name}: could not read this video within 15 seconds.`),
      );
    }, 15000);
    video.preload = "metadata";
    const finish = () => {
      const { duration, videoWidth: width, videoHeight: height } = video;
      cleanup();
      if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 86400 ||
        !width ||
        !height
      )
        reject(new Error(`${file.name}: invalid or unsupported video.`));
      else resolve({ duration, width, height });
    };
    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        // Some browser recordings omit duration; seeking to the end resolves it.
        video.ontimeupdate = () => {
          if (Number.isFinite(video.duration)) finish();
        };
        video.currentTime = 1e10;
      } else finish();
    };
    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          `${file.name}: codec not supported by this browser. Try H.264 MP4 or VP9 WebM.`,
        ),
      );
    };
    video.src = url;
  });
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
