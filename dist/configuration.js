import { iotDevices, iotPowerCables } from "./scene-iot.js";
import { distributionPipes } from "./scene-distribution.js";
import { electricityFeatures } from "./scene-electricity.js";
import { features } from "./geography.js";
import { regionalFeatures, riverPipeline } from "./scene-region.js";
import { photos } from "./photos.js";
import { fencePlantings } from "./scene-flowers.js";
import { waterSystemFeatures } from "./scene-water-system.js";
export const stages = [
  {
    id: 1,
    title: "Current Situation",
    available: true,
    additions: [],
    removals: [],
    overrides: {},
  },
  {
    id: 2,
    title: "Planned Improvements",
    available: true,
    additions: [{
      id: "S-001", name: "Floating solar panels", kind: "solar",
      points: [[174.03,-96.94],[258.60,-25.88],[220.38,19.88],[135.81,-51.18]],
      source: "Sociathon proposal reference", confidence: "Illustrative proposal",
      notes: "Concept layout only. Array placement and size require engineering and reservoir-use review.",
      columns: 6, rows: 3,
    }, ...waterSystemFeatures, ...fencePlantings, riverPipeline, ...electricityFeatures, ...iotDevices, ...iotPowerCables],
    removals: [],
    overrides: { "W-001": { color: "#247da8", waterAppearance: { referenceMix: 0, clarity: 0.82, rippleStrength: 0.025 } } },
  },
  {
    id: 3,
    title: "Future Expansion",
    available: false,
    additions: [],
    removals: [],
    overrides: {},
  },
];
const knownFeatures = [...features, ...regionalFeatures, ...stages.flatMap(stage => stage.additions), ...distributionPipes([...features, ...waterSystemFeatures])];
export const observations = [
  [
    "Intermittent water supply",
    "Residents report interruptions in the village water supply.",
  ],
  [
    "Water quality concerns",
    "Residents raised concerns about water quality. No test results were supplied.",
  ],
  [
    "Pipeline connections",
    "Some families reportedly lack pipeline connections. Their locations were not provided.",
  ],
  [
    "Dependence on the well",
    "The project presentation reports dependence on an overused well. Its location has not been confirmed.",
  ],
  [
    "Power cuts",
    "Residents report that power interruptions affect work and study.",
  ],
];
export const findings = observations.map(([title, description], i) => ({
  id: "obs-" + (i + 1),
  title,
  description,
  source: "Project presentation",
  date: null,
  scope: "Village-wide",
  confidence: "Reported",
  photographs: [],
  featureIds: [],
}));
export function stageFeatures(stageId) {
  const stage = stages.find((s) => s.id === stageId && s.available);
  if (!stage) throw Error("Not built yet");
  return [
    ...features
      .filter((f) => !stage.removals.includes(f.id))
      .map((f) => ({ ...f, ...stage.overrides[f.id] })),
    ...regionalFeatures,
    ...stage.additions,
  ];
}
export const standardStops = [
  ["Study area overview", null],
  ["Village reservoir", "W-001"],
  ["Main road", "R-001"],
  ["Southern residential street", "R-005"],
  ["Malkapuram pillar", "L-001"],
].map(([name, feature]) => ({ name, feature }));
const key = "malkapuram-atlas-working-v1";
export const empty = () => ({
  version: 1,
  site: "malkapuram",
  overrides: {},
  photoMarkers: [],
  bookmarks: structuredClone(standardStops),
});
const safeNum = (n, max) => Number.isFinite(n) && Math.abs(n) <= max;
const str = (s, n = 1000) => typeof s === "string" && s.length <= n;
export function validate(c) {
  const fail = () => {
    throw Error("This file needs a valid Malkapuram version 1 configuration.");
  };
  if (
    !c ||
    c.site !== "malkapuram" ||
    c.version !== 1 ||
    !c.overrides ||
    typeof c.overrides !== "object" ||
    Array.isArray(c.overrides) ||
    !Array.isArray(c.photoMarkers) ||
    !Array.isArray(c.bookmarks) ||
    !c.bookmarks.length ||
    c.bookmarks.length > 100 ||
    c.photoMarkers.length > 250
  )
    fail();
  for (const [id, v] of Object.entries(c.overrides)) {
    if (
      !knownFeatures.some((f) => f.id === id) ||
      !v ||
      Object.keys(v).some(
        (k) =>
          !["name", "notes", "dx", "dz", "rotation", "size", "height"].includes(
            k,
          ),
      )
    )
      fail();
    for (const [k, a] of Object.entries(v)) {
      if (["name", "notes"].includes(k) ? !str(a, 2000) : !safeNum(a, 2000))
        fail();
      if (["height", "size"].includes(k) && a <= 0) fail();
    }
  }
  const ids = new Set();
  for (const p of c.photoMarkers) {
    if (
      !p ||
      !str(p.id, 100) ||
      !/^[-a-zA-Z0-9_]+$/.test(p.id) ||
      ids.has(p.id) ||
      !str(p.title, 160) ||
      !photos.some((i) => i.id === p.photo) ||
      !safeNum(p.x, 500) ||
      !safeNum(p.z, 382)
    )
      fail();
    ids.add(p.id);
  }
  for (const b of c.bookmarks) {
    if (
      !b ||
      !str(b.name, 150) ||
      (b.feature && !knownFeatures.some((f) => f.id === b.feature))
    )
      fail();
    if (b.camera) {
      const v = b.camera;
      if (
        !["orbit", "map", "fly", "walk"].includes(v.mode) ||
        !Array.isArray(v.target) ||
        v.target.length !== 3 ||
        !v.target.every((n) => safeNum(n, 16000)) ||
        !["x", "y", "z", "yaw", "pitch", "distance"].every((k) =>
          safeNum(v[k], 50000),
        )
      )
        fail();
    }
  }
  return c;
}
export function load() {
  const raw = localStorage.getItem(key);
  return raw ? validate(JSON.parse(raw)) : empty();
}
export function save(c) {
  localStorage.setItem(key, JSON.stringify(validate(c)));
}
export const center = (f) =>
  f.points.reduce(
    ([x, z], p) => [x + p[0] / f.points.length, z + p[1] / f.points.length],
    [0, 0],
  );
export function applyEdits(c, stageId = 1) {
  const edited = stageFeatures(stageId).map((f) => {
    const o = c.overrides[f.id];
    if (!o) return f;
    const [cx, cz] = center(f),
      a = ((o.rotation || 0) * Math.PI) / 180,
      scale = o.size || 1;
    const points = f.points.map(([x, z]) => [
      cx +
        (o.dx || 0) +
        ((x - cx) * Math.cos(a) - (z - cz) * Math.sin(a)) * scale,
      cz +
        (o.dz || 0) +
        ((x - cx) * Math.sin(a) + (z - cz) * Math.cos(a)) * scale,
    ]);
    return {
      ...f,
      name: o.name ?? f.name,
      notes: o.notes ?? f.notes,
      height: o.height ?? f.height,
      points,
    };
  });
  if (stageId !== 2) return edited;
  return [...edited.filter(f => f.id !== "PIPE-002" && !f.id.startsWith("BRANCH-")),
    ...distributionPipes(edited)];
}
