import { inside, nearest } from "./scene-math.js";

// Reference-inspired exterior details, not surveyed household attributes.
// All dimensions use the atlas's existing local units (~0.3215 metres).
const palettes = [
  [0.77, 0.75, 0.65], [0.78, 0.79, 0.73], [0.65, 0.74, 0.72],
  [0.77, 0.73, 0.56], [0.72, 0.77, 0.65], [0.75, 0.68, 0.63],
];
const concrete = [0.52, 0.51, 0.46], trim = [0.76, 0.75, 0.68];
const metal = [0.22, 0.29, 0.27], dark = [0.17, 0.19, 0.17];
const shade = (c, k) => c.map(v => Math.min(1, v * k));
function seedFor(f) {
  return [...String(f.id || "building")].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
}
function edgesOf(points) {
  const area = points.reduce((s, a, i) => {
    const b = points[(i + 1) % points.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / (length || 1), (b[1] - a[1]) / (length || 1)];
    const n = area > 0 ? [u[1], -u[0]] : [-u[1], u[0]];
    const point = (x, depth = 0) => [a[0] + u[0] * x + n[0] * depth, a[1] + u[1] * x + n[1] * depth];
    return { a, b, length, u, n, point, index: i };
  }).filter(e => e.length > 0.01);
}
export function buildingLayout(f, features) {
  const seed = seedFor(f), edges = edgesOf(f.points);
  const roads = features.filter(p => p.kind === "road");
  let front = edges[0], best = Infinity, clearance = 0;
  for (const e of edges) {
    const mid = e.point(e.length / 2);
    for (const road of roads) for (let i = 1; i < road.points.length; i++) {
      const q = nearest(...mid, road.points[i - 1], road.points[i]);
      const delta = [q[0] - mid[0], q[1] - mid[1]], distance = Math.hypot(...delta);
      if (delta[0] * e.n[0] + delta[1] * e.n[1] <= 0 || e.length < 7) continue;
      if (distance < best) {
        best = distance; front = e; clearance = distance - (road.width || 9) / 2 - 1.2;
      }
    }
  }
  const bays = front ? Math.max(1, Math.floor(front.length / 23)) : 0;
  const steps = [], awnings = [];
  for (let i = 0; i < bays; i++) {
    const span = front.length / bays, center = span * (i + 0.34);
    const width = Math.min(4.2, span * 0.23), depth = Math.min(2.3, clearance);
    const rect = (left, right, d) => [front.point(left, 0), front.point(right, 0), front.point(right, d), front.point(left, d)];
    const p = rect(center - width / 2 - 0.55, center + width / 2 + 0.55, depth);
    const obstructed = features.some(other => other !== f && (other.kind === "building" || other.kind === "water") &&
      p.some(v => inside(...v, other.points)));
    if (depth > 0.6 && !obstructed) {
      steps.push(p);
      if ((seed + i) % 4 !== 0) awnings.push({ left: center - width / 2 - 1.2, right: Math.min(front.length - 0.5, center + width / 2 + 4), depth: Math.min(3.3, depth + 0.5) });
    }
  }
  return { seed, edges, front, bays, steps, awnings };
}

export function renderBuilding(b, f, id, layout) {
  const { seed, edges, front, bays, steps, awnings } = layout;
  const h = f.height || 14, scale = Math.min(1, h / 10);
  const wall = palettes[seed % palettes.length];
  const prism = (points, bottom, top, color, material = 11) => {
    b.polygon(points, top, shade(color, 1.09), material, id);
    for (const e of edgesOf(points)) {
      const k = 0.83 + 0.19 * (-e.n[0] * 0.75 - e.n[1] * 0.65);
      b.quad([e.a[0], bottom, e.a[1]], [e.b[0], bottom, e.b[1]], [e.b[0], top, e.b[1]], [e.a[0], top, e.a[1]], shade(color, k), material, id);
    }
  };
  // The traced roof envelope and configured height remain authoritative.
  prism(f.points, 0.1, h, wall, 10);
  b.polygon(f.points, h + 0.025, concrete, 11, id);
  for (const e of edges) {
    const k = 0.86 + 0.18 * (-e.n[0] * 0.75 - e.n[1] * 0.65);
    const at = (x, y, depth) => { const p = e.point(x, depth); return [p[0], y, p[1]]; };
    const panel = (left, right, bottom, top, depth, color, material = 11) =>
      b.quad(at(left, bottom, depth), at(right, bottom, depth), at(right, top, depth), at(left, top, depth), shade(color, k), material, id);
    const box = (left, right, bottom, top, near, far, color, material = 11) => {
      prism([e.point(left, near), e.point(right, near), e.point(right, far), e.point(left, far)], bottom, top, color, material);
    };
    // Damp lower wall, slab fascia and a genuine low concrete parapet.
    panel(0, e.length, 0.15, 1.0 * scale, 0.025, [0.46, 0.45, 0.39], 10);
    box(0, e.length, h - 0.45 * scale, h + 0.08 * scale, 0.10, -0.35, trim);
    box(0, e.length, h + 0.08 * scale, h + 0.83 * scale, -0.08, -0.55, concrete);
    const isFront = e === front;
    const count = isFront ? bays : Math.floor(e.length / 19);
    for (let j = 0; j < count; j++) {
      const span = e.length / count, doorX = span * (j + 0.34);
      if (isFront) {
        const dw = Math.min(4.2, span * 0.23), dh = 6.7 * scale;
        panel(doorX - dw / 2 - 0.35, doorX + dw / 2 + 0.35, 0.35 * scale, dh + 0.45 * scale, 0.05, trim);
        panel(doorX - dw / 2, doorX + dw / 2, 0.45 * scale, dh, 0.08, dark, 14);
        const dc = (seed + j) % 2 ? [0.28, 0.37, 0.34] : [0.36, 0.23, 0.20];
        panel(doorX - dw / 2 + 0.16, doorX + dw / 2 - 0.16, 0.5 * scale, dh - 0.15, 0.11, dc, 13);
        for (let q = 1; q < 5; q++) panel(doorX - dw / 2 + dw * q / 5, doorX - dw / 2 + dw * q / 5 + 0.045, 0.6 * scale, dh - 0.25, 0.13, dark, 14);
        panel(doorX + dw * 0.23, doorX + dw * 0.23 + 0.13, 2.8 * scale, 3.35 * scale, 0.18, trim, 12);
        if ((seed + j) % 3 === 0) {
          for (let q = 1; q < 7; q++) panel(doorX - dw / 2 + dw * q / 7, doorX - dw / 2 + dw * q / 7 + 0.065, 0.55 * scale, dh - 0.2, 0.23, metal, 12);
          for (const y of [1.8, 3.6, 5.4]) panel(doorX - dw / 2, doorX + dw / 2, y * scale, (y + 0.08) * scale, 0.24, metal, 12);
        }
        // Small ventilation blocks above the entrance are common in the reference homes.
        const vy = h * 0.77, vw = Math.min(2.6, dw);
        panel(doorX - vw / 2 - 0.18, doorX + vw / 2 + 0.18, vy - 0.15 * scale, vy + 1.15 * scale, 0.05, trim);
        panel(doorX - vw / 2, doorX + vw / 2, vy, vy + scale, 0.08, dark, 14);
        for (let q = 1; q < 4; q++) panel(doorX - vw / 2 + vw * q / 4 - 0.09, doorX - vw / 2 + vw * q / 4 + 0.09, vy, vy + scale, 0.12, trim);
      }
      const wx = span * (j + (isFront ? 0.75 : 0.5)), ww = Math.min(4.2, span * 0.23);
      const low = 3.4 * scale, high = 6.9 * scale;
      if (ww < 1.3) continue;
      panel(wx - ww / 2 - 0.28, wx + ww / 2 + 0.28, low - 0.28, high + 0.28, 0.05, trim);
      panel(wx - ww / 2, wx + ww / 2, low, high, 0.09, dark, 14);
      // Grilles sit forward of dark reveals, with projecting lintels and sills.
      for (let q = 1; q < 5; q++) panel(wx - ww / 2 + ww * q / 5 - 0.045, wx - ww / 2 + ww * q / 5 + 0.045, low, high, 0.20, metal, 12);
      for (let q = 1; q < 3; q++) panel(wx - ww / 2, wx + ww / 2, low + (high - low) * q / 3, low + (high - low) * q / 3 + 0.09, 0.21, metal, 12);
      box(wx - ww / 2 - 0.32, wx + ww / 2 + 0.32, low - 0.3, low - 0.09, 0.05, 0.5, concrete);
      box(wx - ww / 2 - 0.45, wx + ww / 2 + 0.45, high + 0.35, high + 0.53, 0, 0.95, concrete);
    }
    if (isFront) {
      for (const awning of awnings) {
        const { left, right, depth } = awning;
        const y = Math.min(h - 1.2 * scale, 8.3 * scale);
        const strips = Math.ceil((right - left) / 0.3);
        const color = seed % 3 ? [0.38, 0.53, 0.56] : [0.57, 0.55, 0.48];
        for (let j = 0; j < strips; j++) {
          const a = left + (right - left) * j / strips, c = left + (right - left) * (j + 1) / strips;
          const mid = (a + c) / 2;
          b.quad(at(a, y, 0), at(mid, y + 0.06, 0), at(mid, y - 0.55 + 0.06, depth), at(a, y - 0.55, depth), shade(color, 1.05), 12, id);
          b.quad(at(mid, y + 0.06, 0), at(c, y, 0), at(c, y - 0.55, depth), at(mid, y - 0.55 + 0.06, depth), shade(color, 0.8), 12, id);
        }
        panel(left, right, y - 0.7, y - 0.55, depth, color, 12);
      }
      // Narrow drain pipe stays inside the walker clearance around the wall.
      box(e.length - 0.55, e.length - 0.34, 0.6 * scale, h + 0.25 * scale, 0.06, 0.30, [0.53, 0.55, 0.52], 12);
    }
  }
  for (const p of steps) prism(p, 0.12, 0.46 * scale, concrete);
  // Occasional ribbed rooftop storage tanks; omit if the footprint cannot contain one.
  if (seed % 3 === 0 && front) {
    const radius = 1.65 * scale, p = front.point(front.length * 0.72, -3.4 * scale);
    const ring = r => Array.from({ length: 16 }, (_, i) => [p[0] + r * Math.cos(i * Math.PI / 8), p[1] + r * Math.sin(i * Math.PI / 8)]);
    if (ring(radius + 0.5).every(q => inside(...q, f.points))) {
      const color = seed % 2 ? [0.76, 0.77, 0.71] : [0.25, 0.28, 0.26];
      prism(ring(radius + 0.2), h + 0.05, h + 0.42 * scale, concrete);
      prism(ring(radius), h + 0.42 * scale, h + 3.8 * scale, color, 12);
      for (let j = 1; j < 6; j++) prism(ring(radius + 0.06), h + (0.6 + j * 0.48) * scale, h + (0.68 + j * 0.48) * scale, shade(color, 0.88), 12);
      prism(ring(radius * 0.6), h + 3.8 * scale, h + 3.98 * scale, shade(color, 0.8), 12);
    }
  }
}
