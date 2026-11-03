import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  LoaderCircle,
} from "lucide-react";
import { Modal } from "./Modal";
import "./FrameInspection.css";
import { useFramePair } from "../frames/useFramePair";
import { frameAt } from "../frames/types";
import type { CapturedFrame, DecodedFrame } from "../frames/types";
import type { ActionAnchor, MarkerKind, Take } from "../model";

type Translator = (en: string, zh: string) => string;
type View = { zoom: number; x: number; y: number };
function SourceTimeInput({
  value,
  disabled,
  label,
  maximum,
  commit,
}: {
  value: string;
  disabled: boolean;
  label: string;
  maximum: number;
  commit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="number"
      aria-label={label}
      step="0.001"
      min="0"
      max={maximum}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const seconds = Number(draft);
        if (
          !draft.trim() ||
          !Number.isFinite(seconds) ||
          seconds === Number(value)
        )
          setDraft(value);
        else commit(seconds);
      }}
    />
  );
}
export type AnchorChange = {
  id: string;
  offset: number;
  sourceHash?: string;
  anchor?: ActionAnchor;
};
function FrameCanvas({
  frame,
  view,
  center,
  label,
}: {
  frame: DecodedFrame;
  view: View;
  center: (x: number, y: number) => void;
  label: string;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(viewport.current!);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = canvas.current!;
    el.width = frame.width;
    el.height = frame.height;
    el.getContext("2d")!.drawImage(frame.bitmap, 0, 0);
  }, [frame]);
  const scale =
    Math.min(size.width / frame.width, size.height / frame.height) * view.zoom;
  return (
    <div
      className="source-viewport"
      ref={viewport}
      onClick={(e) => {
        const rect = canvas.current!.getBoundingClientRect();
        center(
          Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
          Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
        );
      }}
    >
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        data-source-pts={frame.ptsUs}
        data-frame-index={frame.index}
        style={{
          width: frame.width * scale,
          height: frame.height * scale,
          transform: `translate(${-view.x * 100}%,${-view.y * 100}%)`,
        }}
      />
    </div>
  );
}

function readerError(code: string, t: Translator) {
  if (code === "SOURCE_MISSING")
    return t(
      "Source unavailable. Return to the overview and relink the original video; saved evidence images remain available.",
      "素材不可用。请返回九宫格重新关联原视频；已保存的证据截图仍可查看。",
    );
  if (code === "SOURCE_MISMATCH")
    return t(
      "This source differs from the file behind the saved evidence. Relink the original or import this file as a new take.",
      "当前文件与已有证据的原素材不一致。请关联原文件，或把当前文件作为新版本导入。",
    );
  if (code === "TIMELINE_UNSUPPORTED")
    return t(
      "This source has an unsupported start time or duplicate frame timestamps. Use the overview's nominal stepping; exact evidence capture is unavailable for this source.",
      "此素材的起始时间或重复帧时间戳暂不支持。可返回九宫格按评审帧率查看，此素材暂不能保存精确源帧证据。",
    );
  if (["FRAME_TOO_LARGE", "SOURCE_TOO_LARGE", "TOO_MANY_FRAMES"].includes(code))
    return t(
      "Inspection supports sources up to 2 GB, 60,000 frames and 4096 × 2160 pixels (portrait supported). Use the overview for larger sources.",
      "源帧检查支持不超过 2 GB、60,000 帧、4096 × 2160 像素的素材（支持竖屏）。更大素材请使用九宫格查看。",
    );
  if (code === "HDR_UNSUPPORTED")
    return t(
      "HDR source-frame capture is not supported. Use the overview and a color-managed editor to assess this source.",
      "暂不支持 HDR 源帧截图。请使用九宫格和支持色彩管理的剪辑软件检查此素材。",
    );
  if (["UNSUPPORTED_BROWSER", "UNSUPPORTED_CODEC", "NO_VIDEO"].includes(code))
    return t(
      "Exact frame decoding is unavailable for this browser or codec. Try desktop Chrome/Edge with H.264 MP4 or VP9 WebM, or return to overview playback.",
      "此浏览器或编码暂不支持精确取帧。请尝试桌面 Chrome／Edge 与 H.264 MP4 或 VP9 WebM，或返回九宫格播放。",
    );
  return t(
    "Could not decode this frame. Retry, choose another source, or return to the overview. No evidence was saved.",
    "无法解码此帧。请重试、更换素材或返回九宫格。未保存新的证据。",
  );
}

export function FrameInspection({
  takes,
  initialId,
  sourceTime,
  blind,
  labelFor,
  t,
  close,
  align,
  save,
  chooseWinner,
  decision,
}: {
  takes: Take[];
  initialId: string;
  sourceTime: number;
  blind: boolean;
  labelFor: (take: Take) => string;
  t: Translator;
  close: () => void;
  align: (changes: AnchorChange[]) => void;
  save: (
    takeId: string,
    frame: CapturedFrame,
    text: string,
    kind: MarkerKind,
  ) => Promise<void>;
  chooseWinner: (id: string) => void;
  decision: () => void;
}) {
  const initial = takes.find((t) => t.id === initialId) || takes[0];
  const [ids, setIds] = useState([
    initial.id,
    (
      takes.find(
        (t) =>
          t.id !== initial.id && ["shortlisted", "winner"].includes(t.verdict),
      ) || takes.find((t) => t.id !== initial.id)
    )?.id || "",
  ]);
  const [retry, setRetry] = useState(0);
  const pair = ids.flatMap((id) => takes.find((t) => t.id === id) || []);
  const initialTime = sourceTime - initial.offset;
  const [time, setTime] = useState(initialTime),
    [active, setActive] = useState(0);
  const [aligning, setAligning] = useState(false),
    [action, setAction] = useState("");
  const [anchors, setAnchors] = useState<(ActionAnchor | null)[]>([null, null]);
  const [undo, setUndo] = useState<AnchorChange[] | null>(null);
  const [note, setNote] = useState(""),
    [kind, setKind] = useState<MarkerKind>("issue");
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [saveError, setSaveError] = useState("");
  const [view, setView] = useState<View>({ zoom: 1, x: 0.5, y: 0.5 });
  const reader = useFramePair(pair, initialTime, retry);
  const ready =
    reader.frames.length === pair.length &&
    reader.infos.length === pair.length &&
    !reader.loading &&
    !reader.error;
  const blocked = !ready || saving;
  const maximum = Math.max(...pair.map((p) => p.duration - p.offset), 0);
  const minimum = -Math.max(...pair.map((p) => p.offset), 0);
  const seek = (at: number) => {
    if (!reader.infos.length || saving) return;
    setTime(at);
    setMessage("");
    reader.request(
      pair.map((take, i) => frameAt(reader.infos[i].ptsUs, at + take.offset)),
    );
  };
  const move = (slot: number, index: number) => {
    if (blocked) return;
    setActive(slot);
    setMessage("");
    const at =
      reader.infos[slot].ptsUs[
        Math.max(0, Math.min(index, reader.infos[slot].ptsUs.length - 1))
      ];
    if (aligning)
      reader.request(
        reader.frames.map((f, i) =>
          i === slot ? frameAt(reader.infos[i].ptsUs, at / 1e6) : f.index,
        ),
      );
    else seek(at / 1e6 - pair[slot].offset);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        blocked
      )
        return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        move(
          active,
          reader.frames[active].index + (e.key === "ArrowLeft" ? -1 : 1),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const changeSource = (slot: number, id: string) => {
    setIds((current) => current.map((v, i) => (i === slot ? id : v)));
    setAligning(false);
    setAnchors([null, null]);
    setUndo(null);
    setActive(0);
    setMessage("");
    setNote("");
    setSaveError("");
    setTime(initialTime);
  };
  const applyAnchors = () => {
    if (!anchors[0] || !anchors[1] || !action.trim()) return;
    setUndo(
      pair.map((p) => ({
        id: p.id,
        offset: p.offset,
        anchor: p.anchor,
        sourceHash: p.sourceHash,
      })),
    );
    align(
      pair.map((p, i) => ({
        id: p.id,
        offset: anchors[i]!.ptsUs / 1e6,
        sourceHash: anchors[i]!.sourceHash,
        anchor: { ...anchors[i]!, label: action.trim() },
      })),
    );
    setTime(0);
    setAligning(false);
    setMessage(
      t(
        "Action aligned. The overview now starts at these frames; playback speed is unchanged.",
        "动作已对齐。九宫格将从这些帧开始，播放速度保持不变。",
      ),
    );
    reader.request(
      anchors.map((a, i) => frameAt(reader.infos[i].ptsUs, a!.ptsUs / 1e6)),
    );
  };
  const saveEvidence = async () => {
    if (blocked || !note.trim()) return;
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const expected = reader.frames[active];
      const captured = await reader.capture(active, expected.index);
      if (
        captured.ptsUs !== expected.ptsUs ||
        captured.sourceHash !== expected.sourceHash
      )
        throw new Error(
          t(
            "Frame changed. Inspect it again before saving.",
            "画面已变化，请重新检查后保存。",
          ),
        );
      await save(pair[active].id, captured, note.trim(), kind);
      setNote("");
      setMessage(
        t(
          "Frame evidence saved. Review its link in Decision.",
          "源帧证据已保存，可在选片依据中查看关联。",
        ),
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={t("Source-frame inspection", "源帧检查")}
      close={close}
      locked={saving}
      className="frame-inspection"
    >
      <div className="frame-inspection-tools">
        <span>
          {aligning
            ? t(
                "Find the same action in each take independently.",
                "分别找到两条视频中的同一动作。",
              )
            : t(
                "Both views follow source timestamps. Arrow keys step the active source.",
                "按源帧时间戳联动查看，方向键移动当前版本的真实帧。",
              )}
        </span>
        <label>
          {t("Linked zoom", "联动放大")}{" "}
          <select
            aria-label={t("Linked zoom", "联动放大")}
            value={view.zoom}
            onChange={(e) => setView({ ...view, zoom: Number(e.target.value) })}
          >
            {[1, 2, 4].map((v) => (
              <option key={v} value={v}>
                {v * 100}%
              </option>
            ))}
          </select>
        </label>
        <button
          className="button subtle"
          onClick={() => setView({ zoom: 1, x: 0.5, y: 0.5 })}
        >
          {t("Reset view", "重置视图")}
        </button>
        <button
          className="button"
          disabled={saving || pair.length !== 2 || !ready}
          aria-pressed={aligning}
          onClick={() => {
            setAligning(!aligning);
            setAnchors([null, null]);
            setMessage("");
            if (aligning) seek(time);
          }}
        >
          <Crosshair size={15} />
          {aligning
            ? t("Cancel alignment", "取消对齐")
            : t("Align action", "对齐动作")}
        </button>
      </div>
      <div
        className={`source-pair ${pair.length === 1 ? "source-single" : ""}`}
      >
        {ids.map((id, slot) => {
          const take = pair[slot],
            frame = reader.frames[slot],
            info = reader.infos[slot];
          if (slot === 1 && !id)
            return (
              <div className="source-add" key="empty">
                <label>
                  {t("Compare with", "对比版本")}
                  <select
                    aria-label={t("Source B", "版本 B")}
                    value=""
                    disabled={saving || takes.length < 2}
                    onChange={(e) => changeSource(1, e.target.value)}
                  >
                    <option value="">
                      {t("Choose a second take", "选择第二条视频")}
                    </option>
                    {takes
                      .filter((x) => x.id !== ids[0])
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {blind ? labelFor(x) : x.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            );
          const letter = String.fromCharCode(65 + slot);
          return (
            <section
              className={`source-pane ${active === slot ? "active" : ""}`}
              key={slot}
              aria-label={t(`Inspection ${letter}`, `检查 ${letter}`)}
            >
              <div className="source-pane-heading">
                <button
                  className="source-letter"
                  disabled={saving}
                  aria-pressed={active === slot}
                  onClick={() => setActive(slot)}
                >
                  {letter}
                </button>
                <select
                  aria-label={t(`Source ${letter}`, `版本 ${letter}`)}
                  value={id}
                  disabled={saving}
                  onChange={(e) => changeSource(slot, e.target.value)}
                >
                  {slot === 1 && (
                    <option value="">{t("Single source", "只看一条")}</option>
                  )}
                  {takes
                    .filter(
                      (x) =>
                        !ids.some((other, i) => i !== slot && other === x.id),
                    )
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {blind ? labelFor(x) : x.name}
                      </option>
                    ))}
                </select>
                <button
                  className={`button subtle ${take.verdict === "winner" ? "source-winner" : ""}`}
                  disabled={saving}
                  onClick={() => chooseWinner(take.id)}
                  aria-label={t(
                    `Select winner ${letter}`,
                    `选定成片 ${letter}`,
                  )}
                >
                  <Check size={14} />
                  {take.verdict === "winner"
                    ? t("Selected", "已选")
                    : t("Select", "选定")}
                </button>
              </div>
              {frame && (
                <FrameCanvas
                  frame={frame}
                  view={view}
                  center={(x, y) => {
                    setActive(slot);
                    setView({ ...view, x, y });
                  }}
                  label={t(`Source frame ${letter}`, `原片画面 ${letter}`)}
                />
              )}
              {!frame && (
                <div className="source-viewport source-placeholder">
                  {reader.loading ? (
                    <LoaderCircle className="spin" size={26} />
                  ) : (
                    <Camera size={26} />
                  )}
                </div>
              )}
              <div className="source-frame-controls">
                <button
                  className="icon-button"
                  aria-label={t(
                    `Previous source frame ${letter}`,
                    `上一源帧 ${letter}`,
                  )}
                  disabled={blocked || frame?.index === 0}
                  onClick={() => move(slot, frame.index - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="source-frame-position">
                  {frame && info
                    ? `${frame.index + 1} / ${info.ptsUs.length}`
                    : "—"}
                  <small>{t("source frame", "源帧")}</small>
                </span>
                <button
                  className="icon-button"
                  aria-label={t(
                    `Next source frame ${letter}`,
                    `下一源帧 ${letter}`,
                  )}
                  disabled={blocked || frame?.index === info?.ptsUs.length - 1}
                  onClick={() => move(slot, frame.index + 1)}
                >
                  <ChevronRight size={18} />
                </button>
                <label>
                  {t("Source", "原片")}
                  <SourceTimeInput
                    label={t(`Source time ${letter}`, `原片时间 ${letter}`)}
                    maximum={take.duration}
                    value={frame ? (frame.ptsUs / 1e6).toFixed(6) : ""}
                    disabled={blocked}
                    commit={(at) => move(slot, frameAt(info.ptsUs, at))}
                  />
                  <span>s</span>
                </label>
              </div>
              {aligning ? (
                <button
                  className={`button anchor-button ${anchors[slot] ? "is-set" : ""}`}
                  disabled={blocked}
                  onClick={() => {
                    setAnchors((old) =>
                      old.map((a, i) =>
                        i === slot
                          ? {
                              ptsUs: frame.ptsUs,
                              trackId: frame.trackId,
                              sourceHash: frame.sourceHash,
                              label: action,
                            }
                          : a,
                      ),
                    );
                    setActive(slot);
                  }}
                >
                  {anchors[slot]
                    ? `${t("Anchor", "锚点")} ${(anchors[slot]!.ptsUs / 1e6).toFixed(6)} s`
                    : t(
                        `Use this frame as anchor ${letter}`,
                        `设此帧为锚点 ${letter}`,
                      )}
                </button>
              ) : (
                <p className="source-anchor-note">
                  {take.anchor
                    ? `${t("Action", "动作")} ${blind ? t("anchor", "锚点") : take.anchor.label} · ${(take.anchor.ptsUs / 1e6).toFixed(6)} s`
                    : t("No action anchor", "未设置动作锚点")}
                  {frame &&
                    (time + take.offset < 0 ||
                      time + take.offset > take.duration) && (
                      <span>{t(" · Endpoint held", " · 停留在端点")}</span>
                    )}
                </p>
              )}
            </section>
          );
        })}
      </div>
      <div
        className="source-progress"
        role="status"
        aria-live="polite"
        data-reader-error={reader.error || undefined}
      >
        {reader.loading
          ? t("Reading source frames…", "正在读取源帧…")
          : reader.error
            ? readerError(reader.error, t)
            : message ||
              t(
                "Click a picture to center the linked zoom. Evidence always saves the full original frame.",
                "点击画面设置联动放大中心。证据始终保存完整原片画面。",
              )}
        {reader.error && (
          <>
            <button className="button" onClick={() => setRetry((v) => v + 1)}>
              {t("Retry", "重试")}
            </button>
            {pair.length === 2 && (
              <button className="button" onClick={() => changeSource(1, "")}>
                {t("Inspect A only", "只检查 A")}
              </button>
            )}
          </>
        )}
      </div>
      {aligning ? (
        <div className="action-alignment">
          <label>
            {t("Action name", "动作名称")}
            <input
              aria-label={t("Action name", "动作名称")}
              value={action}
              maxLength={120}
              onChange={(e) => setAction(e.target.value)}
              placeholder={t("Hand touches the cup", "手碰到杯子")}
            />
          </label>
          <button
            className="button primary"
            disabled={blocked || !anchors[0] || !anchors[1] || !action.trim()}
            onClick={applyAnchors}
          >
            {t("Align these frames", "对齐这两帧")}
          </button>
        </div>
      ) : (
        <div className="source-timeline">
          <span>
            {t("Review", "比较")} {time.toFixed(6)} s
          </span>
          <input
            type="range"
            aria-label={t("Inspection timeline", "源帧检查时间轴")}
            min={minimum}
            max={maximum}
            step="0.001"
            value={Math.max(minimum, Math.min(maximum, time))}
            disabled={!reader.infos.length || saving || !!reader.error}
            onChange={(e) => seek(Number(e.target.value))}
          />
          {undo && (
            <button
              className="button subtle"
              disabled={blocked}
              onClick={() => {
                align(undo);
                setUndo(null);
                setMessage(
                  t("Previous offsets restored.", "已恢复之前的偏移。"),
                );
                setTime(0);
                reader.request(
                  pair.map((_, i) =>
                    frameAt(reader.infos[i].ptsUs, undo[i].offset),
                  ),
                );
              }}
            >
              {t("Undo alignment", "撤销对齐")}
            </button>
          )}
        </div>
      )}
      <div className="frame-evidence-form">
        <label className="evidence-target">
          {t("Evidence for", "证据来自")}
          <select
            aria-label={t("Evidence source", "证据版本")}
            value={active}
            disabled={saving}
            onChange={(e) => setActive(Number(e.target.value))}
          >
            {pair.map((_, i) => (
              <option key={i} value={i}>
                {String.fromCharCode(65 + i)}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label={t("Evidence kind", "证据类型")}
          value={kind}
          disabled={saving}
          onChange={(e) => setKind(e.target.value as MarkerKind)}
        >
          <option value="issue">{t("Issue", "问题")}</option>
          <option value="good">{t("Good moment", "亮点")}</option>
          <option value="note">{t("Note", "备注")}</option>
        </select>
        <textarea
          aria-label={t("Frame observation", "源帧观察")}
          value={note}
          maxLength={2000}
          rows={2}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("What does this frame show?", "这一帧说明了什么？")}
        />
        <button
          className="button primary"
          disabled={blocked || !note.trim()}
          onClick={() => void saveEvidence()}
        >
          <Camera size={16} />
          {saving
            ? t("Saving…", "正在保存…")
            : t("Save frame evidence", "保存源帧证据")}
        </button>
      </div>
      {saveError && (
        <p className="frame-save-error" role="alert">
          {saveError}
        </p>
      )}
      <footer className="source-inspection-footer">
        <button className="button subtle" disabled={saving} onClick={close}>
          {t("Back to overview", "返回九宫格")}
        </button>
        <span>
          {t(
            "Original source · no generated frames · silent inspection",
            "原片解码 · 不生成中间帧 · 静音检查",
          )}
        </span>
        <button className="button" disabled={saving} onClick={decision}>
          {t("Decision & record", "选片依据与记录")}
        </button>
      </footer>
    </Modal>
  );
}
