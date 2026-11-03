import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Star,
  X,
  MessageSquare,
  Link2,
  Film,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Take, Verdict } from "../model";
import type { Transport } from "../useTransport";
import { sourceFor } from "../media";
type T = (en: string, zh: string) => string;

export function TakeCard({
  take,
  label,
  active,
  blind,
  transport,
  select,
  verdict,
  relink,
  revision,
  t,
}: {
  take: Take;
  label: string;
  active: boolean;
  blind: boolean;
  transport: Transport;
  select: () => void;
  verdict: (value: Verdict) => void;
  relink: () => void;
  revision: number;
  t: T;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    setReady(false);
    setError(false);
    setSource(null);
    sourceFor(take)
      .then((result) => {
        if (disposed) {
          result?.release();
          return;
        }
        if (result) {
          setSource(result.url);
          release = result.release;
        } else setError(true);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [take.id, take.demo, revision]);
  const register = transport.register;
  const ref = useCallback(
    (video: HTMLVideoElement | null) =>
      register(take.id, video, take.offset, take.duration),
    [register, take.id, take.offset, take.duration],
  );
  const statuses = {
    unreviewed: "",
    shortlisted: t("Shortlist", "入围"),
    rejected: t("Rejected", "淘汰"),
    winner: t("Selected take", "最终选定"),
  };
  return (
    <article
      className={`take-card ${active ? "active" : ""} ${take.verdict}`}
      data-testid="take-card"
      onClick={select}
    >
      <div className="take-visual">
        {source && !error && (
          <video
            ref={ref}
            src={source}
            preload="auto"
            playsInline
            muted={!active || !sound}
            aria-label={label}
            onError={() => setError(true)}
            onLoadedData={(e) => {
              setReady(true);
              e.currentTarget.currentTime = Math.min(
                transport.time + take.offset,
                take.duration - 0.001,
              );
            }}
          />
        )}
        {!ready && !error && (
          <div className="video-placeholder">
            <Film size={23} />
            <span>{t("Loading source…", "正在读取素材…")}</span>
          </div>
        )}
        {error && (
          <div className="video-placeholder">
            <Link2 size={24} />
            <span>{t("Source unavailable", "素材不可用")}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                relink();
              }}
            >
              {t("Relink video", "重新关联视频")}
            </button>
          </div>
        )}
        <button
          className="take-select"
          aria-label={t(`Inspect ${label}`, `查看 ${label}`)}
          aria-pressed={active}
          onClick={select}
        >
          <span className="take-letter">{label.split(" · ")[0]}</span>
        </button>
        {take.verdict !== "unreviewed" && (
          <span className={`verdict-badge ${take.verdict}`}>
            {take.verdict === "winner" ? (
              <Check size={11} />
            ) : take.verdict === "shortlisted" ? (
              <Star size={11} />
            ) : (
              <X size={11} />
            )}
            {statuses[take.verdict]}
          </span>
        )}
        {active && ready && (
          <button
            className="sound-button icon-button"
            aria-label={
              sound
                ? t("Mute take", "静音")
                : t("Listen to this take", "试听当前版本")
            }
            onClick={(e) => {
              e.stopPropagation();
              setSound(!sound);
            }}
          >
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        )}
        <div className="card-markers">
          {take.markers.map((m) => (
            <span
              key={m.id}
              className={m.kind}
              style={{ left: `${(m.time / take.duration) * 100}%` }}
              title={`${m.time.toFixed(2)}s: ${m.text}`}
            />
          ))}
        </div>
      </div>
      <div className="take-card-footer">
        <div className="take-caption">
          <span title={blind ? label : take.name}>
            {blind
              ? t("Anonymous take", "匿名版本")
              : take.name.replace(/\.[^.]+$/, "")}
          </span>
          <small>
            {blind
              ? t("Identity hidden", "来源已隐藏")
              : `${take.width} × ${take.height}`}
            <i />
            {take.duration.toFixed(1)}s
            {take.markers.length > 0 && (
              <>
                <MessageSquare size={10} />
                {take.markers.length}
              </>
            )}
          </small>
        </div>
        <div className="take-actions">
          <button
            className={take.verdict === "rejected" ? "is-on rejected" : ""}
            aria-label={t(`Reject ${label}`, `淘汰 ${label}`)}
            aria-pressed={take.verdict === "rejected"}
            title={t("Reject (X)", "淘汰 (X)")}
            onClick={(e) => {
              e.stopPropagation();
              verdict(take.verdict === "rejected" ? "unreviewed" : "rejected");
            }}
          >
            <X size={14} />
          </button>
          <button
            className={
              take.verdict === "shortlisted" ? "is-on shortlisted" : ""
            }
            aria-label={t(`Shortlist ${label}`, `入围 ${label}`)}
            aria-pressed={take.verdict === "shortlisted"}
            title={t("Shortlist (S)", "入围 (S)")}
            onClick={(e) => {
              e.stopPropagation();
              verdict(
                take.verdict === "shortlisted" ? "unreviewed" : "shortlisted",
              );
            }}
          >
            <Star size={13} />
          </button>
          <button
            className={take.verdict === "winner" ? "is-on winner" : ""}
            aria-label={t(`Select winner ${label}`, `选定 ${label}`)}
            aria-pressed={take.verdict === "winner"}
            title={t("Select winner (W)", "选定 (W)")}
            onClick={(e) => {
              e.stopPropagation();
              verdict(take.verdict === "winner" ? "unreviewed" : "winner");
            }}
          >
            <Check size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
