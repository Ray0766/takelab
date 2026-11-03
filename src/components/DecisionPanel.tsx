import type { Decision, Marker, Shot, Take } from "../model";
import { timecode } from "../model";

export function DecisionPanel({
  shot,
  takes,
  fps,
  blind,
  change,
  revisit,
  record,
  t,
}: {
  shot: Shot;
  takes: Take[];
  fps: number;
  blind: boolean;
  change: (decision: Decision) => void;
  revisit: (take: Take, marker: Marker) => void;
  record: (take: Take) => void;
  t: (en: string, zh: string) => string;
}) {
  if (blind)
    return (
      <p className="decision-hint">
        {t(
          "Reveal identities to read the decision record. Earlier notes may mention a source.",
          "揭晓来源后可查看选片依据，已有文字可能提及来源。",
        )}
      </p>
    );
  const winner = takes.find((take) => take.verdict === "winner");
  if (!winner)
    return (
      <p className="decision-hint">
        {t(
          "Select a winner for this shot, then connect your reason to the moments that support it.",
          "先为本镜头选定成片，再把选择理由与支持它的时间点连起来。",
        )}
      </p>
    );
  const decision = shot.decision || {
    takeId: winner.id,
    reason: "",
    evidence: [],
  };
  const markers = takes.flatMap((take) =>
    take.markers.map((marker) => ({ take, marker })),
  );
  return (
    <section
      className="decision-panel"
      aria-label={t("Shot decision", "镜头选片依据")}
    >
      <div className="decision-winner">
        <small>{t("Selected for this shot", "本镜头选定版本")}</small>
        <strong>{winner.name}</strong>
        <details className="decision-id">
          <summary>{t("Source ID", "素材 ID")}</summary>
          <code>{winner.id}</code>
        </details>
        <button className="button subtle" onClick={() => record(winner)}>
          {t("Open winner record", "查看成片制作记录")}
        </button>
      </div>
      <label className="decision-reason">
        {t("Why this take?", "为什么选这一条？")}
        <textarea
          value={decision.reason}
          maxLength={4000}
          placeholder={t(
            "What held up, and what ruled the others out?",
            "它在哪些方面更可靠，其他版本为什么被淘汰？",
          )}
          onChange={(e) => change({ ...decision, reason: e.target.value })}
        />
      </label>
      <div className="decision-evidence-heading">
        <strong>{t("Supporting moments", "时间点证据")}</strong>
        <span>
          {decision.evidence.length} {t("linked", "条已关联")}
        </span>
      </div>
      <p className="decision-hint">
        {t(
          "Link observations from any candidate in this shot. Times refer to the original source.",
          "可关联本镜头任一候选的观察，时间均对应原始素材。",
        )}
      </p>
      {!markers.length && (
        <p className="decision-hint">
          {t(
            "Pause at a meaningful moment and add a marker first.",
            "在关键时刻暂停，先添加一条标记。",
          )}
        </p>
      )}
      {markers.map(({ take, marker }) => {
        const linked = decision.evidence.some(
          (ref) => ref.takeId === take.id && ref.markerId === marker.id,
        );
        return (
          <div className={`evidence-item ${marker.kind}`} key={marker.id}>
            <label>
              <input
                type="checkbox"
                checked={linked}
                onChange={(e) =>
                  change({
                    ...decision,
                    evidence: e.target.checked
                      ? [
                          ...decision.evidence,
                          { takeId: take.id, markerId: marker.id },
                        ]
                      : decision.evidence.filter(
                          (ref) => ref.markerId !== marker.id,
                        ),
                  })
                }
              />
              <span>
                <strong>{take.name}</strong>
                <span>{marker.text}</span>
              </span>
            </label>
            <button
              className="evidence-time"
              disabled={marker.time < take.offset}
              title={
                marker.time < take.offset
                  ? t(
                      "Before the review offset. Reduce the offset to revisit.",
                      "位于评审起点之前，请先减小偏移。",
                    )
                  : undefined
              }
              onClick={() => revisit(take, marker)}
            >
              {timecode(marker.time, fps)} <span>{t("Revisit", "回看")}</span>
            </button>
          </div>
        );
      })}
      <p className="decision-status" role="status">
        {decision.reason.trim() && decision.evidence.length
          ? t(
              "Reason and evidence linked. Included in the project and production record.",
              "理由与证据已关联，将随项目和制作记录导出。",
            )
          : t(
              "Decision incomplete: add a reason and link at least one moment.",
              "依据尚未完整：请填写理由并关联至少一个时间点。",
            )}
      </p>
    </section>
  );
}
