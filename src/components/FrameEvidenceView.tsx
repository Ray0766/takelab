import { useEffect, useState } from "react";
import { Camera, ImageOff } from "lucide-react";
import { readMedia } from "../storage";
import { validateFrameBlob } from "../evidence";
import { download } from "../media";
import type { FrameEvidence, Marker, Take } from "../model";
import { Modal } from "./Modal";

export function EvidenceThumbnail({
  frame,
  open,
  label,
}: {
  frame: FrameEvidence;
  open: () => void;
  label: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let canceled = false,
      objectUrl = "";
    void readMedia(frame.id)
      .then((blob) => {
        if (!canceled && blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      canceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [frame.id]);
  return (
    <button
      className="frame-evidence-preview"
      onClick={open}
      aria-label={label}
    >
      {url ? <img src={url} loading="lazy" alt="" /> : <ImageOff size={18} />}
      <span>
        <Camera size={13} />
        {label}
        <small>{(frame.ptsUs / 1e6).toFixed(6)} s</small>
      </span>
    </button>
  );
}
export function FrameEvidenceView({
  take,
  marker,
  close,
  revisit,
  t,
}: {
  take: Take;
  marker: Marker;
  close: () => void;
  revisit: () => void;
  t: (en: string, zh: string) => string;
}) {
  const frame = marker.frame!;
  const [url, setUrl] = useState(""),
    [blob, setBlob] = useState<Blob | null>(null),
    [error, setError] = useState("");
  const [sourceAvailable, setSourceAvailable] = useState(false);
  useEffect(() => {
    let canceled = false,
      objectUrl = "";
    void (async () => {
      try {
        const image = await readMedia(frame.id);
        if (!image)
          throw new Error(
            t(
              "Evidence image is missing. Restore a complete project backup.",
              "证据截图丢失，请恢复完整的项目备份。",
            ),
          );
        await validateFrameBlob(image, frame);
        const source = await readMedia(take.id);
        if (canceled) return;
        objectUrl = URL.createObjectURL(image);
        setUrl(objectUrl);
        setBlob(image);
        setSourceAvailable(!!source || !!take.demo);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      canceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [frame.id, take.id, t]);
  return (
    <Modal
      title={t("Saved frame evidence", "已保存的源帧证据")}
      close={close}
      className="frame-evidence-view"
    >
      <div className="saved-frame-heading">
        <strong>{take.name}</strong>
        <span>
          {t("Source", "原片")} {(frame.ptsUs / 1e6).toFixed(6)} s ·{" "}
          {frame.width} × {frame.height}
        </span>
      </div>
      {url ? (
        <img className="saved-frame-image" src={url} alt={marker.text} />
      ) : (
        <p role={error ? "alert" : "status"}>
          {error || t("Verifying image…", "正在校验截图…")}
        </p>
      )}
      <p className="saved-frame-observation">{marker.text}</p>
      <details className="frame-provenance">
        <summary>{t("Frame provenance", "源帧信息")}</summary>
        <dl>
          <dt>{t("Presentation frame", "呈现帧序号")}</dt>
          <dd>{frame.frameIndex + 1}</dd>
          <dt>{t("Track / PTS", "轨道 / 时间戳")}</dt>
          <dd>
            {frame.trackId} / {frame.ptsUs} µs
          </dd>
          <dt>{t("Source SHA-256", "原片 SHA-256")}</dt>
          <dd>{frame.sourceHash}</dd>
          <dt>{t("PNG SHA-256", "截图 SHA-256")}</dt>
          <dd>{frame.pngHash}</dd>
        </dl>
      </details>
      {!sourceAvailable && url && (
        <p className="decision-hint">
          {t(
            "The original video is not available. This verified screenshot remains viewable; relink the original to inspect adjacent frames.",
            "原视频暂不可用。仍可查看这张经过校验的截图，关联原视频后可检查相邻帧。",
          )}
        </p>
      )}
      <footer className="source-inspection-footer">
        <button
          className="button"
          disabled={!blob}
          onClick={() =>
            blob && download(blob, `takelab-evidence-${frame.id}.png`)
          }
        >
          {t("Download PNG", "下载 PNG")}
        </button>
        <button
          className="button primary"
          disabled={!sourceAvailable || !url}
          onClick={revisit}
        >
          {t("Inspect original frame", "检查原片此帧")}
        </button>
      </footer>
    </Modal>
  );
}
