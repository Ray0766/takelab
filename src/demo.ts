import { createProject, uid } from "./model";
import type { Take } from "./model";
import assets from "./demo-assets.json";

export function createDemo() {
  const p = createProject("Orbit / a study in motion");
  p.shots = [
    { id: uid(), name: "01 · The approach" },
    { id: uid(), name: "02 · Surface detail" },
    { id: uid(), name: "03 · The departure" },
  ];
  const descriptions = [
    "A clean arc. Watch the rim light.",
    "The moon drifts off its intended orbit.",
    "Stable silhouette, quieter lighting.",
    "A brief flicker at the midpoint.",
    "Good depth; slightly faster motion.",
    "The ring breaks near the end.",
    "Balanced light and camera motion.",
    "A second moon appears briefly.",
    "Soft focus reduces surface detail.",
  ];
  p.takes = Array.from({ length: 9 }, (_, i): Take => ({
    id: uid(),
    shotId: p.shots[0].id,
    name: `orbit_take_${String(i + 1).padStart(2, "0")}.mp4`,
    size: assets[`orbit-0${i + 1}.mp4` as keyof typeof assets],
    lastModified: 0,
    type: "video/mp4",
    duration: 6,
    width: 640,
    height: 360,
    offset: 0,
    verdict: "unreviewed",
    model: ["Demo · Aurora", "Demo · Solstice", "Demo · Meridian"][i % 3],
    prompt:
      "A slow orbital approach to a pale moon above a dark, sculpted landscape. Thin atmospheric haze, soft ivory rim light, a delicate orbital ring. Locked horizon, restrained camera movement, cinematic wide composition.",
    negativePrompt: "Flicker, duplicate moon, broken ring, unstable geometry.",
    seed: String(42810 + i * 37),
    settings: `Original procedural demo · 640 × 360 · 24 fps · 6 seconds\n${descriptions[i]}\nModel names are fictional; this is not a model benchmark.`,
    cost: null,
    markers: [],
    references: [],
    demo: `orbit-0${i + 1}.mp4`,
  }));
  return p;
}
