import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileText,
  Flag,
  FolderOpen,
  Grid2X2,
  Grid3X3,
  HardDrive,
  ImagePlus,
  Keyboard,
  Layers,
  LoaderCircle,
  Maximize,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  blindOrder,
  clamp,
  createProject,
  createTake,
  inferShotName,
  moveTake,
  reconcileDecisions,
  reviewDuration,
  setVerdict,
  timecode,
  uid,
} from "./model";
import type { Language, MarkerKind, Project, Take, Verdict } from "./model";
import {
  removeProjectMedia,
  loadProject,
  replaceProject,
  saveProject,
  writeMedia,
} from "./storage";
import { download, inspectVideo } from "./media";
import { createDemo } from "./demo";
import { exportArchive, importArchive, reportMarkdown } from "./archive";
import { recordComparison, recordingType } from "./record";
import { useTransport } from "./useTransport";
import { Modal } from "./components/Modal";
import { TakeCard } from "./components/TakeCard";
import { ReferenceImage } from "./components/ReferenceImage";
import { DecisionPanel } from "./components/DecisionPanel";

type Dialog = "import" | "export" | "help" | "project" | null;
type Notice = { text: string; error?: boolean } | null;

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("takelab-language") === "zh"
        ? "zh"
        : localStorage.getItem("takelab-language") === "en"
          ? "en"
          : navigator.language.startsWith("zh")
            ? "zh"
            : "en";
    } catch {
      return "en";
    }
  });
  const t = useCallback(
    (en: string, zh: string) => (language === "zh" ? zh : en),
    [language],
  );
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [shotId, setShotId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState<"saving" | "saved" | "error">("saved");
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [blind, setBlind] = useState(false);
  const [blindSeed, setBlindSeed] = useState(1);
  const [grid, setGrid] = useState(9);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideRejected, setHideRejected] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<
    "record" | "markers" | "decision"
  >("record");
  const [markerText, setMarkerText] = useState("");
  const [markerKind, setMarkerKind] = useState<MarkerKind>("issue");
  const [autoGroup, setAutoGroup] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveInput = useRef<HTMLInputElement>(null);
  const relinkInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const markerInput = useRef<HTMLTextAreaElement>(null);
  const relinkId = useRef("");
  const [revisitTarget, setRevisitTarget] = useState<{
    id: string;
    time: number;
  } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const saveSequence = useRef(0);
  const importLock = useRef(false);

  useEffect(() => {
    let canceled = false;
    loadProject()
      .then((p) => {
        if (canceled) return;
        const value = p || createProject();
        setProject(value);
        setShotId(value.shots[0].id);
      })
      .catch((e) => {
        if (!canceled) setLoadError(String(e));
      });
    return () => {
      canceled = true;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("takelab-language", language);
    } catch {
      /* UI preference is optional. */
    }
  }, [language]);
  useEffect(() => {
    if (!project) return;
    const sequence = ++saveSequence.current;
    setSaved("saving");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveProject(project))
      .then(() => {
        if (sequence === saveSequence.current) setSaved("saved");
      })
      .catch((e) => {
        if (sequence === saveSequence.current) {
          setSaved("error");
          setNotice({
            text:
              t(
                "Could not save locally. Export a backup before closing. ",
                "本地保存失败，请在关闭前导出备份。",
              ) + String(e),
            error: true,
          });
        }
      });
  }, [project, t]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setNotice(null),
      notice.error ? 14000 : 6000,
    );
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (saved !== "saved" || busy) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [saved, busy]);

  const shot = project?.shots.find((s) => s.id === shotId);
  const shotTakes = useMemo(
    () => project?.takes.filter((take) => take.shotId === shotId) || [],
    [project, shotId],
  );
  const ordered = useMemo(
    () => (blind ? blindOrder(shotTakes, blindSeed) : shotTakes),
    [shotTakes, blind, blindSeed],
  );
  const filtered = useMemo(
    () =>
      ordered.filter(
        (take) =>
          (!hideRejected || take.verdict !== "rejected") &&
          (filter === "all" ||
            (filter === "shortlisted" &&
              ["shortlisted", "winner"].includes(take.verdict)) ||
            take.verdict === filter) &&
          (blind ||
            take.name.toLowerCase().includes(search.toLowerCase()) ||
            take.model.toLowerCase().includes(search.toLowerCase())),
      ),
    [ordered, hideRejected, filter, blind, search],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / grid));
  const visible = useMemo(
    () => filtered.slice(page * grid, (page + 1) * grid),
    [filtered, page, grid],
  );
  const duration = reviewDuration(visible);
  const layout = visible.length === 1 ? 1 : visible.length === 2 ? 4 : grid;
  const rows = Math.ceil(
    visible.length / (layout === 9 ? 3 : layout === 4 ? 2 : 1),
  );
  const transport = useTransport(duration, project?.fps || 24);
  const selected = project?.takes.find((take) => take.id === selectedId);
  const shotWinner = shotTakes.find((take) => take.verdict === "winner");
  const labelFor = (take: Take) =>
    `${String.fromCharCode(65 + (ordered.indexOf(take) % 26))}${ordered.indexOf(take) >= 26 ? Math.floor(ordered.indexOf(take) / 26) + 1 : ""} · ${t("Take", "版本")} ${String(ordered.indexOf(take) + 1).padStart(2, "0")}`;
  useEffect(() => {
    setPage(0);
    transport.pause();
    transport.seek(0);
  }, [shotId, filter, grid, blind, search, hideRejected]);
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);
  useEffect(() => {
    if (!visible.some((take) => take.id === selectedId))
      setSelectedId(visible[0]?.id || "");
  }, [visible, selectedId]);
  useEffect(() => {
    setMarkerText("");
  }, [selectedId]);
  useEffect(() => {
    if (!revisitTarget) return;
    const index = filtered.findIndex((take) => take.id === revisitTarget.id);
    if (index < 0) return;
    const targetPage = Math.floor(index / grid);
    if (page !== targetPage) {
      setPage(targetPage);
      return;
    }
    setSelectedId(revisitTarget.id);
    transport.pause();
    transport.seek(revisitTarget.time);
    document.getElementById(`take-${revisitTarget.id}`)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    setRevisitTarget(null);
  }, [revisitTarget, filtered, page, grid]);
  const revealTake = (take: Take, sourceTime = take.offset) => {
    setFilter("all");
    setHideRejected(false);
    setSearch("");
    setRevisitTarget({
      id: take.id,
      time: Math.max(0, sourceTime - take.offset),
    });
  };

  const update = (change: (p: Project) => Project) =>
    setProject((p) =>
      p
        ? {
            ...reconcileDecisions(change(p)),
            updatedAt: new Date().toISOString(),
          }
        : p,
    );
  const patchTake = (id: string, patch: Partial<Take>) =>
    update((p) => ({
      ...p,
      takes: p.takes.map((take) =>
        take.id === id ? { ...take, ...patch } : take,
      ),
    }));
  const verdict = (id: string, value: Verdict) =>
    update((p) => setVerdict(p, id, value));
  const error = (e: unknown) =>
    setNotice({
      text: e instanceof Error ? e.message : String(e),
      error: true,
    });
  const removeMedia = async (next: Project, ids: string[]) => {
    setBusy(t("Removing from project…", "正在从项目中移除…"));
    try {
      await saveQueue.current;
      const value = {
        ...reconcileDecisions(next),
        updatedAt: new Date().toISOString(),
      };
      await removeProjectMedia(value, ids);
      setProject(value);
    } catch (e) {
      error(e);
    } finally {
      setBusy("");
    }
  };
  const selectShot = (id: string) => {
    setShotId(id);
    setSearch("");
    setFilter("all");
    setHideRejected(false);
  };
  const replace = async (p: Project, media = new Map<string, Blob>()) => {
    transport.pause();
    await saveQueue.current;
    await replaceProject(p, media);
    setProject(p);
    setShotId(p.shots[0].id);
    setSelectedId("");
    setBlind(false);
    setSearch("");
    setFilter("all");
    setHideRejected(false);
    setPage(0);
    setRevision((v) => v + 1);
  };
  const loadDemo = async () => {
    if (
      project?.takes.length &&
      !confirm(
        t(
          "Replace this project with the demo? Export a backup first if you want to keep it.",
          "用演示项目替换当前项目？如需保留，请先导出备份。",
        ),
      )
    )
      return;
    setBusy(t("Opening demo…", "正在打开演示…"));
    try {
      await replace(createDemo());
      setDialog(null);
      setNotice({
        text: t(
          "Nine takes. One decision. Press Space to compare.",
          "9 个版本，选出最好的一条。按空格同步播放。",
        ),
      });
    } catch (e) {
      error(e);
    } finally {
      setBusy("");
    }
  };
  const importFiles = async (files: File[]) => {
    if (!project || importLock.current || busy) return;
    const candidates = files.filter(
      (f) =>
        f.type.startsWith("video/") ||
        /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(f.name),
    );
    if (!candidates.length) {
      error(
        t(
          "Drop video files here. Use Open project for a TakeLab ZIP.",
          "请拖入视频文件。TakeLab ZIP 请通过“打开项目”导入。",
        ),
      );
      return;
    }
    if (
      candidates.length > 200 ||
      project.takes.length + candidates.length > 3000
    ) {
      error(
        t(
          "Import up to 200 videos at a time (3,000 per project).",
          "每批最多导入 200 条视频，每个项目最多 3,000 条。",
        ),
      );
      return;
    }
    importLock.current = true;
    transport.pause();
    setDialog(null);
    let next = project;
    let count = 0;
    let duplicates = 0;
    const failures: string[] = [];
    try {
      for (const [i, file] of candidates.entries()) {
        setBusy(
          t(
            `Importing ${i + 1} / ${candidates.length}`,
            `正在导入 ${i + 1} / ${candidates.length}`,
          ),
        );
        if (
          next.takes.some(
            (take) =>
              take.name === file.name &&
              take.size === file.size &&
              take.lastModified === file.lastModified,
          )
        ) {
          duplicates++;
          continue;
        }
        try {
          const metadata = await inspectVideo(file);
          let targetShot =
            next.shots.find((s) => s.id === shotId) || next.shots[0];
          if (autoGroup) {
            const name = inferShotName(file.name);
            const match = next.shots.find((s) => s.name === name);
            if (match) targetShot = match;
            else {
              targetShot = { id: uid(), name };
            }
          }
          const take = createTake(file, targetShot.id, metadata);
          await writeMedia(take.id, file);
          next = {
            ...next,
            shots: next.shots.some((s) => s.id === targetShot.id)
              ? next.shots
              : [...next.shots, targetShot],
            takes: [...next.takes, take],
          };
          count++;
        } catch (e) {
          failures.push(e instanceof Error ? e.message : String(e));
        }
      }
      const nextProject = { ...next, updatedAt: new Date().toISOString() };
      setProject(nextProject);
      if (count) {
        selectShot(next.takes[next.takes.length - 1].shotId);
        setSelectedId(next.takes[next.takes.length - 1].id);
      }
      setNotice({
        text: `${t(`Imported ${count} video(s).`, `已导入 ${count} 条视频。`)} ${duplicates ? t(`${duplicates} duplicate(s) skipped.`, `跳过 ${duplicates} 条重复素材。`) : ""} ${failures.length ? t(`${failures.length} failed: `, `${failures.length} 条失败：`) + failures.slice(0, 3).join(" / ") : ""}`,
        error: failures.length > 0,
      });
    } finally {
      setBusy("");
      importLock.current = false;
    }
  };
  const restore = async (file: File) => {
    setBusy(t("Reading project…", "正在读取项目…"));
    try {
      const result = await importArchive(file);
      if (
        project?.takes.length &&
        !confirm(
          t(
            "Replace the current project with this backup? Export your current project first if needed.",
            "用备份替换当前项目？如需保留当前项目，请先导出。",
          ),
        )
      )
        return;
      await replace(result.project, result.media);
      setDialog(null);
      const missing = result.project.takes.filter(
        (take) => !take.demo && !result.media.has(take.id),
      ).length;
      setNotice({
        text: missing
          ? t(
              `Project restored. Relink ${missing} source video(s) using the cards.`,
              `项目已恢复，请在卡片上重新关联 ${missing} 条视频素材。`,
            )
          : t(
              "Project restored with its source files.",
              "项目及其素材已恢复。",
            ),
      });
    } catch (e) {
      error(e);
    } finally {
      setBusy("");
    }
  };
  const relink = async (file: File) => {
    const take = project?.takes.find((take) => take.id === relinkId.current);
    if (!take) return;
    setBusy(t("Relinking source…", "正在关联素材…"));
    try {
      const metadata = await inspectVideo(file);
      if (
        Math.abs(metadata.duration - take.duration) > 0.1 ||
        file.name !== take.name ||
        file.size !== take.size ||
        metadata.width !== take.width ||
        metadata.height !== take.height
      ) {
        throw new Error(
          t(
            "This file does not match the original name, size, duration or dimensions. Import it as a new take to keep existing evidence attached to its original source.",
            "此文件的名称、大小、时长或分辨率与原素材不符。请作为新版本导入，避免已有证据关联到不同素材。",
          ),
        );
      }
      await writeMedia(take.id, file);
      patchTake(take.id, {
        ...metadata,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || take.type,
        demo: undefined,
        offset: Math.min(take.offset, metadata.duration - 0.001),
        markers: take.markers.filter((m) => m.time <= metadata.duration),
      });
      setRevision((v) => v + 1);
      setNotice({ text: t("Source relinked.", "素材已重新关联。") });
    } catch (e) {
      error(e);
    } finally {
      setBusy("");
    }
  };
  const addReference = async (files: File[]) => {
    if (!selected) return;
    setBusy(t("Adding reference…", "正在添加参考图…"));
    try {
      const references = [...selected.references];
      for (const file of files) {
        if (references.length >= 30)
          throw new Error(
            t(
              "Maximum 30 reference images per take.",
              "每个版本最多 30 张参考图。",
            ),
          );
        if (
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
            file.type,
          ) ||
          file.size > 20 * 1024 * 1024
        )
          throw new Error(
            t(
              "Use PNG, JPEG, WebP or GIF images under 20 MB.",
              "请使用小于 20 MB 的 PNG、JPEG、WebP 或 GIF 图片。",
            ),
          );
        const ref = { id: uid(), name: file.name, type: file.type };
        await writeMedia(ref.id, file);
        references.push(ref);
        patchTake(selected.id, { references: [...references] });
      }
    } catch (e) {
      error(e);
    } finally {
      setBusy("");
    }
  };
  const addMarker = () => {
    if (!selected || !markerText.trim()) return;
    const time = clamp(transport.time + selected.offset, 0, selected.duration);
    patchTake(selected.id, {
      markers: [
        ...selected.markers,
        { id: uid(), time, kind: markerKind, text: markerText.trim() },
      ],
    });
    setMarkerText("");
  };
  const focusMarker = () => {
    transport.pause();
    setInspectorOpen(true);
    setInspectorTab("markers");
    setTimeout(() => markerInput.current?.focus(), 0);
  };
  const exportProject = async () => {
    if (!project) return;
    setBusy(t("Packing project…", "正在打包项目…"));
    try {
      const blob = await exportArchive(project, includeSources, (s) =>
        setBusy(t(`Packing project ${s}`, `正在打包项目 ${s}`)),
      );
      download(blob, `${safeName(project.name)}.takelab.zip`);
      setNotice({ text: t("Project backup exported.", "项目备份已导出。") });
    } catch (e) {
      error(e);
    } finally {
      setBusy("");
    }
  };
  const exportVideo = async () => {
    if (!project) return;
    transport.pause();
    setProgress(0);
    setBusy(t("Recording comparison…", "正在录制对比视频…"));
    abort.current = new AbortController();
    const controller = abort.current;
    const hide = () => {
      if (document.hidden) controller.abort();
    };
    document.addEventListener("visibilitychange", hide);
    try {
      const result = await recordComparison(
        visible,
        visible.map((take) =>
          blind ? labelFor(take) : `${take.id} / ${take.name}`,
        ),
        project.fps,
        controller.signal,
        setProgress,
      );
      download(
        result.blob,
        `${blind ? "takelab-blind-comparison" : safeName(shot?.name || "comparison")}.${result.extension}`,
      );
      setNotice({ text: t("Comparison video exported.", "对比视频已导出。") });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError")
        setNotice({
          text: t(
            "Recording canceled. Keep this tab visible while recording.",
            "录制已取消。录制时请保持此标签页可见。",
          ),
        });
      else error(e);
    } finally {
      setBusy("");
      abort.current = null;
      document.removeEventListener("visibilitychange", hide);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        dialog ||
        busy ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement).matches(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        transport.toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        transport.step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        transport.step(1);
      } else if (selected && ["s", "x", "w"].includes(e.key.toLowerCase())) {
        const state = (
          { s: "shortlisted", x: "rejected", w: "winner" } as const
        )[e.key.toLowerCase() as "s" | "x" | "w"];
        verdict(selected.id, selected.verdict === state ? "unreviewed" : state);
      } else if (e.key.toLowerCase() === "m" && selected) {
        e.preventDefault();
        focusMarker();
      } else if (/^[1-9]$/.test(e.key) && visible[Number(e.key) - 1])
        setSelectedId(visible[Number(e.key) - 1].id);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  if (loadError)
    return (
      <main className="loading-screen">
        <ShieldCheck size={40} />
        <h1>{t("Your project could not be opened", "无法打开本地项目")}</h1>
        <p>{loadError}</p>
        <p>
          {t(
            "No stored files have been changed. Check browser storage access, then reload.",
            "存储的文件未被修改。请检查浏览器存储权限后重新加载。",
          )}
        </p>
        <button onClick={() => location.reload()}>
          {t("Reload", "重新加载")}
        </button>
      </main>
    );
  if (!project)
    return (
      <main className="loading-screen">
        <LoaderCircle className="spin" />
        <span>{t("Opening your desk…", "正在打开工作台…")}</span>
      </main>
    );
  return (
    <div
      className="app"
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files") && !dialog && !busy) {
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current--;
        if (dragDepth.current <= 0) {
          setDragging(false);
          dragDepth.current = 0;
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        dragDepth.current = 0;
        if (!dialog && !busy)
          void importFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="video/*,.mkv,.mov"
        hidden
        onChange={(e) => {
          void importFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
        data-testid="video-input"
      />
      <input
        ref={archiveInput}
        type="file"
        accept=".zip"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void restore(e.target.files[0]);
          e.target.value = "";
        }}
        data-testid="archive-input"
      />
      <input
        ref={relinkInput}
        type="file"
        accept="video/*,.mkv,.mov"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void relink(e.target.files[0]);
          e.target.value = "";
        }}
        data-testid="relink-input"
      />
      <input
        ref={referenceInput}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          void addReference(Array.from(e.target.files || []));
          e.target.value = "";
        }}
        data-testid="reference-input"
      />

      <header className="topbar" inert={!!busy}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setDialog("project");
          }}
          aria-label="TakeLab project menu"
        >
          <strong>TakeLab</strong>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
        </a>
        <div className="project-heading">
          <span className="top-divider" />
          <FolderOpen size={15} />
          <input
            value={project.name}
            maxLength={200}
            aria-label={t("Project name", "项目名称")}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
          <button
            className="icon-button"
            onClick={() => setDialog("project")}
            aria-label={t("Project menu", "项目菜单")}
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div className={`save-status ${saved}`}>
          <span />
          {saved === "saved"
            ? t("Saved on this device", "已保存到本机")
            : saved === "saving"
              ? t("Saving…", "保存中…")
              : t("Save failed · export backup", "保存失败 · 请导出备份")}
        </div>
        <button
          className="language-button"
          aria-label="Switch language"
          onClick={() => setLanguage(language === "en" ? "zh" : "en")}
        >
          {language === "en" ? "中文" : "EN"}
        </button>
        <button
          className="button subtle top-import"
          disabled={!!busy}
          onClick={() => setDialog("import")}
        >
          <Plus size={16} />
          {t("Import videos", "导入视频")}
        </button>
        <button
          className="button primary"
          disabled={!!busy || !project.takes.length}
          onClick={() => {
            transport.pause();
            setDialog("export");
          }}
        >
          <ArrowDownToLine size={15} />
          {t("Export", "导出")}
        </button>
      </header>

      <div
        className={`workbench ${inspectorOpen && selected ? "" : "inspector-closed"}`}
        inert={!!busy}
      >
        <aside className="shot-strip">
          <div className="sidebar-heading">
            <span>{t("Shots", "镜头")}</span>
            <span className="count">{project.shots.length}</span>
            <button
              className="icon-button"
              aria-label={t("Add shot", "新增镜头")}
              title={t("Add shot", "新增镜头")}
              onClick={() => {
                const id = uid();
                update((p) => ({
                  ...p,
                  shots: [
                    ...p.shots,
                    {
                      id,
                      name: `Shot ${String(p.shots.length + 1).padStart(2, "0")}`,
                    },
                  ],
                }));
                selectShot(id);
              }}
            >
              <Plus size={15} />
            </button>
          </div>
          <nav className="shot-list" aria-label={t("Shots", "镜头")}>
            {project.shots.map((s, i) => {
              const takes = project.takes.filter(
                (take) => take.shotId === s.id,
              );
              const winner = takes.some((take) => take.verdict === "winner");
              return (
                <button
                  key={s.id}
                  className={`shot-item ${shotId === s.id ? "selected" : ""}`}
                  onClick={() => selectShot(s.id)}
                >
                  <span className="shot-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="shot-name">
                    <strong>{s.name.replace(/^\d+\s*[·.-]\s*/, "")}</strong>
                    <small>
                      {takes.length} {t("takes", "个版本")}
                      {winner && (
                        <>
                          <i />
                          <Check size={10} />
                          {t("Selected", "已选定")}
                        </>
                      )}
                    </small>
                  </span>
                  <ChevronRight size={12} />
                </button>
              );
            })}
          </nav>
          <button className="sidebar-help" onClick={() => setDialog("help")}>
            <Keyboard size={15} />
            {t("Shortcuts & help", "快捷键与帮助")}
          </button>
        </aside>

        <main className="main-panel">
          <div className="review-tools">
            <section className="shot-header">
              <div>
                <div className="shot-title">
                  <input
                    aria-label={t("Shot name", "镜头名称")}
                    value={shot?.name || ""}
                    maxLength={200}
                    onChange={(e) =>
                      update((p) => ({
                        ...p,
                        shots: p.shots.map((s) =>
                          s.id === shotId ? { ...s, name: e.target.value } : s,
                        ),
                      }))
                    }
                  />
                  {!shotTakes.length && project.shots.length > 1 && (
                    <button
                      className="icon-button"
                      aria-label={t("Delete empty shot", "删除空镜头")}
                      onClick={() => {
                        update((p) => ({
                          ...p,
                          shots: p.shots.filter((s) => s.id !== shotId),
                        }));
                        setShotId(
                          project.shots.find((s) => s.id !== shotId)!.id,
                        );
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {shotWinner && !blind && (
                <button
                  className="selection-summary"
                  onClick={() => {
                    revealTake(shotWinner, transport.time + shotWinner.offset);
                    setInspectorOpen(true);
                    setInspectorTab("decision");
                  }}
                >
                  <Check size={16} />
                  <span>
                    {t("Selected", "已选")}{" "}
                    {labelFor(shotWinner).split(" · ")[0]}
                  </span>
                  <small>{t("Review decision", "查看选片依据")}</small>
                </button>
              )}
              <button
                className="button details-toggle"
                hidden={!selected}
                disabled={!selected}
                aria-expanded={inspectorOpen && !!selected}
                aria-controls="take-inspector"
                onClick={() => setInspectorOpen(!inspectorOpen)}
              >
                <SlidersHorizontal size={16} />
                {t("Details", "详情")}
              </button>
            </section>
            <div className="compare-toolbar" hidden={!shotTakes.length}>
              <div
                className="filter-tabs"
                role="group"
                aria-label={t("Filter takes", "筛选版本")}
              >
                <button
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  {t("All takes", "全部")}
                  <span>{shotTakes.length}</span>
                </button>
                <button
                  className={filter === "shortlisted" ? "active" : ""}
                  onClick={() => setFilter("shortlisted")}
                >
                  <Star size={12} />
                  {t("Shortlist", "入围")}
                </button>
              </div>
              <div className="view-filters">
                <label className="hide-rejected">
                  <input
                    type="checkbox"
                    checked={hideRejected}
                    onChange={(e) => setHideRejected(e.target.checked)}
                  />
                  {t("Hide rejected", "隐藏淘汰")}
                </label>
                {!blind && (
                  <label className="take-search">
                    <Search size={12} />
                    <input
                      aria-label={t("Search takes", "搜索版本")}
                      placeholder={t("Find take…", "查找版本…")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <div className="compare-options">
                <button
                  className={`blind-toggle ${blind ? "enabled" : ""}`}
                  onClick={() => {
                    setBlind(!blind);
                    if (!blind) {
                      setBlindSeed(Math.floor(Math.random() * 1e9));
                      setSearch("");
                    }
                  }}
                >
                  {blind ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{t("Blind mode", "盲选模式")}</span>
                  <i />
                </button>
                <span className="toolbar-divider" />
                <div
                  className="grid-options"
                  role="group"
                  aria-label={t("Grid layout", "对比布局")}
                >
                  {[
                    [1, Maximize],
                    [4, Grid2X2],
                    [9, Grid3X3],
                  ].map(([value, Icon]) => {
                    const Component = Icon as typeof Grid2X2;
                    return (
                      <button
                        key={String(value)}
                        className={grid === value ? "active" : ""}
                        onClick={() => setGrid(value as number)}
                        aria-label={t(`${value} view`, `${value} 宫格`)}
                        title={t(`${value} view`, `${value} 宫格`)}
                      >
                        <Component size={15} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {blind && (
            <div className="blind-banner">
              <EyeOff size={13} />
              {t(
                "Names and generation records are hidden. Order is shuffled.",
                "已隐藏名称和生成记录，并打乱版本顺序。",
              )}
              <button onClick={() => setBlind(false)}>
                {t("Reveal identities", "揭晓来源")}
              </button>
            </div>
          )}
          <div className="grid-scroller">
            {visible.length ? (
              <div
                className={`take-grid grid-${layout} ${rows === 1 ? "single-row" : ""}`}
                style={
                  {
                    "--rows": rows,
                  } as CSSProperties
                }
              >
                {!abort.current &&
                  visible.map((take) => (
                    <TakeCard
                      key={take.id}
                      take={take}
                      label={labelFor(take)}
                      active={take.id === selectedId}
                      blind={blind}
                      transport={transport}
                      select={() => setSelectedId(take.id)}
                      inspect={() => {
                        setSelectedId(take.id);
                        setInspectorOpen(true);
                      }}
                      verdict={(value) => verdict(take.id, value)}
                      revision={revision}
                      t={t}
                      relink={() => {
                        relinkId.current = take.id;
                        relinkInput.current?.click();
                      }}
                    />
                  ))}
              </div>
            ) : shotTakes.length ? (
              <div className="empty-state small">
                <Search size={30} />
                <h2>{t("No takes in this view", "当前筛选没有版本")}</h2>
                <button
                  className="button subtle"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                    setHideRejected(false);
                  }}
                >
                  {t("Clear filters", "清除筛选")}
                </button>
              </div>
            ) : (
              <div className="empty-state welcome">
                <div className="welcome-copy">
                  <h2>
                    {t(
                      "Side by side.\nSee the difference.",
                      "并排看。\n选一条。",
                    )}
                  </h2>
                  <p>
                    {t(
                      "Bring every version of a shot into the same moment.\nKeep the take — and the reason you chose it.",
                      "把同一镜头的不同版本，放在同一时刻。\n留下选中的那条，也留下选择的依据。",
                    )}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setDialog("import")}
                  >
                    <Plus size={18} />
                    {t("Import your first takes", "导入第一批视频")}
                  </button>
                  <small>
                    {t(
                      "Local files. No accounts. No uploads.",
                      "本地处理，无需账号，无需上传。",
                    )}
                  </small>
                </div>
                <div className="demo-preview">
                  <div className="empty-preview" aria-hidden="true">
                    {[1, 4, 7].map((n) => (
                      <img
                        key={n}
                        src={`${import.meta.env.BASE_URL}demo/preview-${n}.webp`}
                        alt=""
                      />
                    ))}
                  </div>
                  <button
                    className="demo-link"
                    disabled={!!busy}
                    onClick={() => void loadDemo()}
                  >
                    <Play size={13} />
                    {t("Open the sample project", "打开示例项目")}
                  </button>
                  <small>
                    {t(
                      "Orbit / 9 synthetic takes / 6 seconds",
                      "Orbit / 9 条合成素材 / 6 秒",
                    )}
                  </small>
                </div>
              </div>
            )}
          </div>
          {filtered.length > grid && (
            <div className="pagination">
              <span>
                {page * grid + 1}–{Math.min((page + 1) * grid, filtered.length)}{" "}
                / {filtered.length} {t("takes", "个版本")}
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={page === 0}
                  aria-label={t("Previous page", "上一页")}
                  onClick={() => {
                    transport.pause();
                    setPage((p) => p - 1);
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {page + 1} / {pageCount}
                </span>
                <button
                  className="icon-button"
                  disabled={page + 1 >= pageCount}
                  aria-label={t("Next page", "下一页")}
                  onClick={() => {
                    transport.pause();
                    setPage((p) => p + 1);
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
          <section
            className="transport"
            hidden={!shotTakes.length}
            aria-label={t("Playback controls", "播放控制")}
          >
            <div className="transport-main">
              <div className="transport-left">
                <button
                  className="icon-button"
                  title={t("Back one frame (←)", "后退一帧 (←)")}
                  aria-label={t("Previous frame", "上一帧")}
                  disabled={!duration}
                  onClick={() => transport.step(-1)}
                >
                  <SkipBack size={16} />
                </button>
                <button
                  className="play-button"
                  aria-label={
                    transport.playing
                      ? t("Pause", "暂停")
                      : t("Play all", "全部播放")
                  }
                  disabled={!duration}
                  onClick={transport.toggle}
                >
                  {transport.playing ? (
                    <Pause size={19} fill="currentColor" />
                  ) : (
                    <Play size={19} fill="currentColor" />
                  )}
                </button>
                <button
                  className="icon-button"
                  title={t("Forward one frame (→)", "前进一帧 (→)")}
                  aria-label={t("Next frame", "下一帧")}
                  disabled={!duration}
                  onClick={() => transport.step(1)}
                >
                  <SkipForward size={16} />
                </button>
                <div className="time-readout">
                  <strong data-testid="timecode">
                    {timecode(transport.time, project.fps)}
                  </strong>
                  <span> / {timecode(duration, project.fps)}</span>
                </div>
              </div>
              <div className="transport-right">
                <button
                  className={`icon-button ${transport.loop ? "is-on" : ""}`}
                  aria-pressed={transport.loop}
                  aria-label={t("Loop playback", "循环播放")}
                  onClick={() => transport.setLoop(!transport.loop)}
                >
                  <Repeat2 size={16} />
                </button>
                <select
                  aria-label={t("Playback speed", "播放速度")}
                  value={transport.rate}
                  onChange={(e) => transport.setRate(Number(e.target.value))}
                >
                  {[0.25, 0.5, 1, 2].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}×
                    </option>
                  ))}
                </select>
                <button
                  className="button marker-button"
                  aria-label={t("Add marker", "添加标记")}
                  disabled={!selected}
                  onClick={focusMarker}
                >
                  <Flag size={13} />
                  {t("Add marker", "添加标记")}
                  <kbd>M</kbd>
                </button>
              </div>
            </div>
            <div className="timeline">
              <div className="timeline-ruler">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i}>
                    {timecode((duration * i) / 6, project.fps).slice(0, 5)}
                  </span>
                ))}
              </div>
              <div className="timeline-track">
                <div
                  className="timeline-fill"
                  style={{
                    width: `${duration ? (transport.time / duration) * 100 : 0}%`,
                  }}
                />
                {selected?.markers
                  .filter(
                    (m) =>
                      m.time >= selected.offset &&
                      m.time - selected.offset <= duration,
                  )
                  .map((m) => (
                    <button
                      key={m.id}
                      className={`timeline-marker ${m.kind}`}
                      style={{
                        left: `${duration ? ((m.time - selected.offset) / duration) * 100 : 0}%`,
                      }}
                      title={m.text}
                      aria-label={t(
                        `Jump to marker ${m.text}`,
                        `跳转到标记 ${m.text}`,
                      )}
                      onClick={() => {
                        transport.pause();
                        transport.seek(m.time - selected.offset);
                      }}
                    />
                  ))}
                <input
                  type="range"
                  min="0"
                  max={duration || 1}
                  step={1 / project.fps}
                  value={transport.time}
                  disabled={!duration}
                  aria-label={t("Timeline", "时间轴")}
                  onChange={(e) => transport.seek(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="transport-foot">
              <span>
                <Layers size={11} />
                {transport.buffering
                  ? t("Waiting for video…", "正在等待视频…")
                  : t(
                      `${visible.length} takes linked`,
                      `${visible.length} 条同步播放`,
                    )}
                <i />
                {t("Shorter takes hold their last frame", "较短版本停留在末帧")}
              </span>
              <label>
                <select
                  aria-label={t("Review FPS", "评审帧率")}
                  value={project.fps}
                  onChange={(e) =>
                    update((p) => ({ ...p, fps: Number(e.target.value) }))
                  }
                >
                  {[12, 24, 25, 30, 50, 60].map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} fps
                    </option>
                  ))}
                </select>
                {t("timebase", "时间基准")}
              </label>
            </div>
          </section>
        </main>

        <aside
          className="inspector"
          id="take-inspector"
          hidden={!inspectorOpen || !selected}
        >
          <div className="inspector-heading">
            <span>{t("Notes & record", "标记与记录")}</span>
            <button
              className="icon-button"
              aria-label={t("Close details", "收起详情")}
              onClick={() => {
                setInspectorOpen(false);
                document
                  .querySelector<HTMLButtonElement>(".details-toggle")
                  ?.focus();
              }}
            >
              <X size={16} />
            </button>
          </div>
          {selected ? (
            <>
              <div className="inspector-summary">
                <div>
                  <span className="inspector-letter">
                    {labelFor(selected).split(" · ")[0]}
                  </span>
                  <div>
                    <h2>{labelFor(selected).split(" · ")[1]}</h2>
                    <p>
                      {blind
                        ? t("Identity hidden", "来源已隐藏")
                        : selected.name}
                    </p>
                  </div>
                </div>
                <div className={`inspector-verdict ${selected.verdict}`}>
                  {selected.verdict === "winner" ? (
                    <>
                      <CheckCheck size={13} />
                      {t("Selected for this shot", "已选为本镜头成片")}
                    </>
                  ) : selected.verdict === "shortlisted" ? (
                    <>
                      <Star size={13} />
                      {t("On the shortlist", "已加入候选")}
                    </>
                  ) : selected.verdict === "rejected" ? (
                    <>
                      <X size={13} />
                      {t("Rejected take", "已淘汰版本")}
                    </>
                  ) : (
                    <>
                      <span className="pending-dot" />
                      {t("Not reviewed yet", "尚未评选")}
                    </>
                  )}
                </div>
              </div>
              <div className="inspector-tabs">
                <button
                  className={inspectorTab === "decision" ? "active" : ""}
                  onClick={() => setInspectorTab("decision")}
                >
                  {t("Decision", "选片依据")}
                </button>
                <button
                  className={inspectorTab === "record" ? "active" : ""}
                  onClick={() => setInspectorTab("record")}
                >
                  {t("Generation record", "制作记录")}
                </button>
                <button
                  className={inspectorTab === "markers" ? "active" : ""}
                  onClick={() => setInspectorTab("markers")}
                >
                  {t("Markers", "标记")}
                  <span>{selected.markers.length}</span>
                </button>
              </div>
              <div className="inspector-content">
                {inspectorTab === "decision" && shot ? (
                  <DecisionPanel
                    shot={shot}
                    takes={shotTakes}
                    fps={project.fps}
                    blind={blind}
                    t={t}
                    change={(decision) =>
                      update((p) => ({
                        ...p,
                        shots: p.shots.map((s) =>
                          s.id === shot.id ? { ...s, decision } : s,
                        ),
                      }))
                    }
                    revisit={(take, marker) => revealTake(take, marker.time)}
                    record={(take) => {
                      revealTake(take);
                      setInspectorTab("record");
                    }}
                  />
                ) : inspectorTab === "record" ? (
                  blind ? (
                    <div className="blind-inspector">
                      <EyeOff size={28} />
                      <h3>{t("Source details hidden", "来源信息已隐藏")}</h3>
                      <p>
                        {t(
                          "Model, prompt, references and cost are hidden while you compare.",
                          "比较期间隐藏模型、提示词、参考图和成本。",
                        )}
                      </p>
                      <button
                        className="button subtle"
                        onClick={() => setBlind(false)}
                      >
                        {t("Reveal generation record", "揭晓制作记录")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="field-row">
                        <label>
                          {t("Model / source", "模型 / 来源")}
                          <input
                            aria-label={t("Model / source", "模型 / 来源")}
                            value={selected.model}
                            maxLength={200}
                            placeholder={t(
                              "e.g. Sora, Runway, camera…",
                              "例如 Sora、Runway、实拍…",
                            )}
                            onChange={(e) =>
                              patchTake(selected.id, { model: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="field-row">
                        <label>
                          {t("Prompt", "提示词")}
                          <button
                            className="inline-action"
                            aria-label={t("Copy prompt", "复制提示词")}
                            disabled={!selected.prompt}
                            onClick={() =>
                              navigator.clipboard
                                .writeText(selected.prompt)
                                .then(() =>
                                  setNotice({
                                    text: t("Prompt copied.", "提示词已复制。"),
                                  }),
                                )
                                .catch(error)
                            }
                          >
                            <Copy size={12} />
                          </button>
                          <textarea
                            className="prompt-field"
                            aria-label={t("Prompt", "提示词")}
                            value={selected.prompt}
                            maxLength={20000}
                            placeholder={t(
                              "What made this take? Paste the prompt here.",
                              "记录这条视频是怎么生成的。",
                            )}
                            onChange={(e) =>
                              patchTake(selected.id, { prompt: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="field-row">
                        <label>
                          {t("Reference images", "参考图")}
                          <button
                            className="inline-action"
                            aria-label={t("Add reference images", "添加参考图")}
                            onClick={() => referenceInput.current?.click()}
                          >
                            <Plus size={13} />
                          </button>
                        </label>
                        <div className="references">
                          {selected.references.map((ref) => (
                            <ReferenceImage
                              key={ref.id}
                              reference={ref}
                              remove={() => {
                                void removeMedia(
                                  {
                                    ...project,
                                    takes: project.takes.map((take) =>
                                      take.id === selected.id
                                        ? {
                                            ...take,
                                            references: take.references.filter(
                                              (r) => r.id !== ref.id,
                                            ),
                                          }
                                        : take,
                                    ),
                                  },
                                  [ref.id],
                                );
                              }}
                            />
                          ))}
                          <button
                            className="reference-add"
                            aria-label={t("Add reference", "添加参考")}
                            onClick={() => referenceInput.current?.click()}
                          >
                            <ImagePlus size={18} />
                            <span>{t("Add image", "添加图片")}</span>
                          </button>
                        </div>
                      </div>
                      <div className="field-pair">
                        <label>
                          {t("Seed", "种子")}
                          <input
                            aria-label={t("Seed", "种子")}
                            value={selected.seed}
                            maxLength={500}
                            placeholder="—"
                            onChange={(e) =>
                              patchTake(selected.id, { seed: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t("Cost (USD)", "成本 (USD)")}
                          <input
                            aria-label={t("Cost (USD)", "成本 (USD)")}
                            type="number"
                            min="0"
                            max="1000000000"
                            step="0.01"
                            value={selected.cost ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              patchTake(selected.id, {
                                cost:
                                  e.target.value === ""
                                    ? null
                                    : clamp(Number(e.target.value), 0, 1e9),
                              })
                            }
                          />
                        </label>
                      </div>
                      <details className="advanced-fields">
                        <summary>
                          {t("More generation details", "更多生成细节")}
                          <ChevronDown size={13} />
                        </summary>
                        <label>
                          {t("Negative prompt", "负面提示词")}
                          <textarea
                            aria-label={t("Negative prompt", "负面提示词")}
                            value={selected.negativePrompt}
                            maxLength={20000}
                            onChange={(e) =>
                              patchTake(selected.id, {
                                negativePrompt: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("Settings & notes", "参数与备注")}
                          <textarea
                            aria-label={t("Settings & notes", "参数与备注")}
                            value={selected.settings}
                            maxLength={20000}
                            onChange={(e) =>
                              patchTake(selected.id, {
                                settings: e.target.value,
                              })
                            }
                          />
                        </label>
                      </details>
                      <div className="source-details">
                        <h3>{t("Source & alignment", "素材与对齐")}</h3>
                        <div>
                          <span>{t("Resolution", "分辨率")}</span>
                          <span>
                            {selected.width} × {selected.height}
                          </span>
                        </div>
                        <div>
                          <span>{t("Duration", "时长")}</span>
                          <span>{selected.duration.toFixed(3)} s</span>
                        </div>
                        <label>
                          {t("Start offset (seconds)", "起始偏移（秒）")}
                          <input
                            aria-label={t(
                              "Start offset (seconds)",
                              "起始偏移（秒）",
                            )}
                            type="number"
                            min="0"
                            max={Math.max(0, selected.duration - 0.001)}
                            step={1 / project.fps}
                            value={selected.offset}
                            onChange={(e) => {
                              transport.pause();
                              patchTake(selected.id, {
                                offset: clamp(
                                  Number(e.target.value),
                                  0,
                                  Math.max(0, selected.duration - 0.001),
                                ),
                              });
                            }}
                          />
                        </label>
                        <label>
                          {t("Move to shot", "移到镜头")}
                          <select
                            aria-label={t("Move to shot", "移到镜头")}
                            value={selected.shotId}
                            onChange={(e) =>
                              update((p) =>
                                moveTake(p, selected.id, e.target.value),
                              )
                            }
                          >
                            {project.shots.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="source-actions">
                          <button
                            onClick={() => {
                              relinkId.current = selected.id;
                              relinkInput.current?.click();
                            }}
                          >
                            {t("Relink source", "重新关联素材")}
                          </button>
                          <button
                            className="danger-text"
                            onClick={async () => {
                              if (
                                !confirm(
                                  t(
                                    "Remove this take and its notes from the project? The original file is not changed.",
                                    "从项目中移除此版本及其记录？原始文件不会改变。",
                                  ),
                                )
                              )
                                return;
                              const id = selected.id;
                              await removeMedia(
                                {
                                  ...project,
                                  takes: project.takes.filter(
                                    (take) => take.id !== id,
                                  ),
                                },
                                [id, ...selected.references.map((r) => r.id)],
                              );
                            }}
                          >
                            <Trash2 size={11} />
                            {t("Remove", "移除")}
                          </button>
                        </div>
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <div className="marker-composer">
                      <div>
                        <Flag size={13} />
                        <span>
                          {timecode(
                            Math.min(
                              transport.time + selected.offset,
                              selected.duration,
                            ),
                            project.fps,
                          )}
                        </span>
                        <small>{t("source time", "素材时间")}</small>
                      </div>
                      <select
                        aria-label={t("Marker type", "标记类型")}
                        value={markerKind}
                        onChange={(e) =>
                          setMarkerKind(e.target.value as MarkerKind)
                        }
                      >
                        <option value="issue">
                          {t("Issue / artifact", "问题 / 穿帮")}
                        </option>
                        <option value="good">
                          {t("Good moment", "精彩片段")}
                        </option>
                        <option value="note">{t("Note", "备注")}</option>
                      </select>
                      <textarea
                        ref={markerInput}
                        aria-label={t("Marker note", "标记内容")}
                        placeholder={t(
                          "What happens at this moment?",
                          "这个时间点发生了什么？",
                        )}
                        value={markerText}
                        maxLength={2000}
                        onChange={(e) => setMarkerText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                            addMarker();
                        }}
                      />
                      <button
                        className="button primary"
                        disabled={!markerText.trim()}
                        onClick={addMarker}
                      >
                        <Plus size={13} />
                        {t("Save marker", "保存标记")}
                      </button>
                    </div>
                    <div className="marker-list">
                      {selected.markers.length ? (
                        [...selected.markers]
                          .sort((a, b) => a.time - b.time)
                          .map((m) => (
                            <div className={`marker-item ${m.kind}`} key={m.id}>
                              <button
                                className="marker-time"
                                disabled={m.time < selected.offset}
                                title={
                                  m.time < selected.offset
                                    ? t(
                                        "Before the review offset. Reduce the offset to revisit this marker.",
                                        "标记位于评审起点之前，请减小偏移后查看。",
                                      )
                                    : undefined
                                }
                                onClick={() => {
                                  transport.pause();
                                  transport.seek(
                                    Math.max(0, m.time - selected.offset),
                                  );
                                }}
                              >
                                <span />
                                {timecode(m.time, project.fps)}
                                <Play size={10} />
                              </button>
                              <p>{m.text}</p>
                              <button
                                className="marker-delete icon-button"
                                aria-label={t(
                                  `Delete marker ${m.text}`,
                                  `删除标记 ${m.text}`,
                                )}
                                onClick={() =>
                                  patchTake(selected.id, {
                                    markers: selected.markers.filter(
                                      (x) => x.id !== m.id,
                                    ),
                                  })
                                }
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                      ) : (
                        <div className="no-markers">
                          <MessageSquare size={26} />
                          <p>
                            {t(
                              "Catch the little things.",
                              "记录那些关键细节。",
                            )}
                          </p>
                          <small>
                            {t(
                              "Pause on a moment and leave a note. Your future self will thank you.",
                              "在需要的瞬间暂停，记下穿帮、亮点或想法。",
                            )}
                          </small>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="inspector-footer">
                <HardDrive size={11} />
                {t("Changes save automatically", "修改自动保存在本机")}
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <SlidersHorizontal size={28} />
              <p>{t("No take selected", "尚未选择版本")}</p>
              <span>
                {t(
                  "Select a video to see its prompt, references and review notes.",
                  "选择一个视频，查看提示词、参考图和评审标记。",
                )}
              </span>
            </div>
          )}
        </aside>
      </div>
      {dragging && (
        <div className="drop-overlay">
          <Upload size={40} />
          <h2>{t("Add videos to this shot", "添加视频到当前镜头")}</h2>
          <p>
            {autoGroup
              ? t("Group by filename", "按文件名分组")
              : t(`Add to ${shot?.name}`, `添加到 ${shot?.name}`)}
          </p>
        </div>
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {busy && !dialog && (
        <div className="busy-indicator" role="status">
          <LoaderCircle size={15} className="spin" />
          {busy}
        </div>
      )}

      {dialog === "import" && (
        <Modal
          title={t("Bring your takes together", "把不同版本放到一起")}
          close={() => setDialog(null)}
        >
          <p className="modal-description">
            {t(
              "Import videos from any model, camera or workflow. Originals stay untouched.",
              "导入任意模型、相机或工作流生成的视频。原文件保持不变。",
            )}
          </p>
          <div className="import-zone">
            <Upload size={30} />
            <h3>{t("Start with a few possibilities.", "先放进几种可能。")}</h3>
            <button
              className="button primary"
              onClick={() => fileInput.current?.click()}
            >
              {t("Choose video files", "选择视频文件")}
            </button>
            <small>
              {t(
                "MP4, WebM, MOV* · Multiple files welcome",
                "MP4、WebM、MOV* · 支持多选",
              )}
            </small>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={autoGroup}
              onChange={(e) => setAutoGroup(e.target.checked)}
            />
            <span>
              {t("Group shots from filenames", "根据文件名分组")}
              <small>
                {t(
                  "scene01_take_01.mp4 → scene01",
                  "scene01_take_01.mp4 → scene01",
                )}
              </small>
            </span>
          </label>
          <p className="fine-print">
            {t(
              "* Playback depends on your browser’s codec support. H.264 MP4 and VP9 WebM are recommended. MOV is a container, not a guarantee of support.",
              "* 播放能力取决于浏览器支持的编码。建议 H.264 MP4 或 VP9 WebM；MOV 容器并不保证可播放。",
            )}
          </p>
        </Modal>
      )}
      {dialog === "project" && (
        <Modal
          title={t("Your workspace", "你的工作台")}
          close={() => setDialog(null)}
          locked={!!busy}
        >
          <p className="modal-description">
            {t(
              "One focused project, saved on this device. Export a backup before switching.",
              "当前项目保存在本机。切换项目之前，请先导出备份。",
            )}
          </p>
          <div className="project-menu">
            <button
              disabled={!!busy}
              onClick={() => archiveInput.current?.click()}
            >
              <FolderOpen size={20} />
              <span>
                <strong>{t("Open a project backup", "打开项目备份")}</strong>
                <small>
                  {t("Restore a .takelab.zip file", "恢复 .takelab.zip 文件")}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
            <button disabled={!!busy} onClick={() => void loadDemo()}>
              <Play size={20} />
              <span>
                <strong>{t("Explore the demo", "体验演示项目")}</strong>
                <small>
                  {t(
                    "Nine original clips, ready to compare",
                    "9 条原创短片，直接开始比较",
                  )}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
            <button
              disabled={!!busy}
              onClick={async () => {
                if (
                  project.takes.length &&
                  !confirm(
                    t(
                      "Start a new project? Export your current project first if you want to keep it.",
                      "新建项目？如需保留当前项目，请先导出备份。",
                    ),
                  )
                )
                  return;
                setBusy(t("Creating project…", "正在新建项目…"));
                try {
                  await replace(createProject());
                  setDialog(null);
                } catch (e) {
                  error(e);
                } finally {
                  setBusy("");
                }
              }}
            >
              <Plus size={20} />
              <span>
                <strong>{t("New project", "新建项目")}</strong>
                <small>
                  {t("Start with a clean desk", "从空白工作台开始")}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
          </div>
          {busy && <p className="modal-status">{busy}</p>}
        </Modal>
      )}
      {dialog === "export" && (
        <Modal
          title={t("Take the work with you", "带走你的制作成果")}
          close={() => setDialog(null)}
          locked={!!busy}
        >
          <p className="modal-description">
            {t(
              "Share a decision. Keep the process. Pick what you need.",
              "分享选片结果，保留制作过程。选择需要的导出内容。",
            )}
          </p>
          <div className="export-section">
            <FileArchive size={23} />
            <div>
              <h3>{t("Project backup", "项目备份")}</h3>
              <p>
                {t(
                  "Editable record + references + optional source videos.",
                  "可编辑记录、参考图，以及可选的视频原片。",
                )}
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={includeSources}
                  disabled={!!busy || blind}
                  onChange={(e) => setIncludeSources(e.target.checked)}
                />
                {t(
                  "Include original videos (up to 512 MB)",
                  "包含原始视频（最多 512 MB）",
                )}
              </label>
              <button
                className="button subtle"
                disabled={!!busy || blind}
                onClick={() => void exportProject()}
              >
                <Download size={13} />
                {t("Export project ZIP", "导出项目 ZIP")}
              </button>
            </div>
          </div>
          <div className="export-section">
            <FileText size={23} />
            <div>
              <h3>{t("Production record", "制作记录")}</h3>
              <p>
                {t(
                  "A readable Markdown report: decisions, prompts, settings and timestamped notes.",
                  "Markdown 报告：选片结果、提示词、参数与时间点标记。",
                )}
              </p>
              <button
                className="button subtle"
                disabled={!!busy || blind}
                onClick={() => {
                  download(
                    new Blob([reportMarkdown(project)], {
                      type: "text/markdown;charset=utf-8",
                    }),
                    `${safeName(project.name)}-record.md`,
                  );
                  setNotice({
                    text: t("Production record exported.", "制作记录已导出。"),
                  });
                }}
              >
                <Download size={13} />
                {t("Export record", "导出记录")}
              </button>
            </div>
          </div>
          <div className="export-section">
            <Video size={23} />
            <div>
              <h3>
                {t("Comparison video", "对比视频")}
                <span className="count">
                  {visible.length} {t("takes", "个版本")}
                </span>
              </h3>
              <p>
                {t(
                  "Record the current page from start to finish, with labels. Silent, up to 1280px wide. Recording takes real time; keep this tab visible. Maximum 120 seconds.",
                  "将当前页从头录到尾，保留版本标签。无声，宽度 1280 像素。按实际时长录制，请保持此页可见。最长 120 秒。",
                )}
              </p>
              <button
                className="button primary"
                disabled={
                  !!busy ||
                  !visible.length ||
                  !recordingType() ||
                  duration > 120
                }
                onClick={() => void exportVideo()}
              >
                <Video size={13} />
                {t("Export comparison", "导出对比视频")}
              </button>
              {!recordingType() && (
                <p className="fine-print">
                  {t(
                    "Recording unavailable. Try Chrome or Edge.",
                    "当前浏览器不支持录制，请使用 Chrome 或 Edge。",
                  )}
                </p>
              )}
              {duration > 120 && (
                <p className="fine-print">
                  {t(
                    "This page exceeds the 120-second export limit.",
                    "当前页超过 120 秒导出上限。",
                  )}
                </p>
              )}
            </div>
          </div>
          {blind && (
            <p className="blind-export">
              <EyeOff size={14} />
              {t(
                "Comparison labels stay anonymous. Reveal identities to export production records.",
                "对比视频保留匿名标签。请揭晓来源后再导出制作记录或项目。",
              )}
            </p>
          )}
          {busy && (
            <div className="export-progress">
              <span>
                <LoaderCircle size={14} className="spin" />
                {busy}
              </span>
              {abort.current && (
                <>
                  <progress max="1" value={progress} />
                  <button
                    className="button subtle"
                    onClick={() => abort.current?.abort()}
                  >
                    {t("Cancel recording", "取消录制")}
                  </button>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title={t("A little less clicking.", "少点几次，多看几眼。")}
          close={() => setDialog(null)}
        >
          <div className="shortcut-list">
            {[
              ["Space", t("Play / pause visible takes", "播放 / 暂停可见版本")],
              ["← / →", t("Step by review timebase", "按评审帧率前后步进")],
              ["1–9", t("Inspect a visible take", "查看对应版本")],
              [
                "S / X / W",
                t(
                  "Shortlist / reject / select winner",
                  "入围 / 淘汰 / 最终选定",
                ),
              ],
              ["M", t("Add a timestamped marker", "添加时间点标记")],
              [
                "Ctrl / ⌘ + Enter",
                t("Save the marker you are writing", "保存正在编辑的标记"),
              ],
            ].map(([key, description]) => (
              <div key={key}>
                <span>{description}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <div className="help-notes">
            <h3>{t("A desk for decisions", "为选片而设计")}</h3>
            <p>
              {t(
                "Only the current page is decoded (up to 9 videos). Use a smaller grid for heavy footage. Select a take to listen to its audio; comparison exports are silent.",
                "仅解码当前页，最多 9 条视频。高码率素材建议减少宫格。可试听当前版本；导出的对比视频为无声。",
              )}
            </p>
            <p>
              {t(
                "Frame stepping uses your chosen review FPS, not detected source frames. Browser seeking and real-time recordings are not frame-exact mastering tools; variable-frame-rate footage may land between source frames.",
                "逐帧步进依据你选择的评审帧率，不自动识别素材帧率。浏览器寻帧和实时录制不保证逐帧精确，可变帧率素材尤其如此。",
              )}
            </p>
            <p>
              {t(
                "Files live in this browser’s local storage. Clearing site data, private browsing or storage eviction can remove them. Keep your originals and export backups; a backup without videos needs relinking after import.",
                "素材存储在此浏览器本地。清除站点数据、隐私模式或空间回收可能导致丢失。请保留原文件并定期导出备份；不含视频的备份恢复后需要重新关联素材。",
              )}
            </p>
            <p>
              {t(
                "Blind mode hides app metadata, not watermarks inside the video. The demo uses original procedural clips and fictional model names; it is not a model benchmark.",
                "盲选隐藏应用中的元数据，无法隐藏画面内的水印。演示片由程序生成，模型名为虚构，不代表模型测评。",
              )}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function safeName(value: string) {
  return (
    value
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .slice(0, 100) || "takelab"
  );
}
