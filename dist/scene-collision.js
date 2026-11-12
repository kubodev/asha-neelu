import { inside, nearest } from "./scene-math.js";
import { buildingLayout } from "./scene-buildings.js";
import { reservoirFence } from "./scene-fence.js";

// A ~30 cm body radius in the existing atlas coordinate system.
export const WALK_RADIUS = 0.95;
export function navigationSolids(features) {
  return features.filter(f => ["building", "water", "river", "storage", "filter", "electricalBox"].includes(f.kind)).flatMap(f => {
    const polygons = f.kind === "building" ? [f.points, ...buildingLayout(f, features).steps] : [f.points];
    return polygons.map(p => ({
      p,
      loX: Math.min(...p.map(v => v[0])), hiX: Math.max(...p.map(v => v[0])),
      loZ: Math.min(...p.map(v => v[1])), hiZ: Math.max(...p.map(v => v[1])),
    }));
  }).concat(features.filter(f=>f.kind==="water").flatMap(f=>reservoirFence(f.points,features.filter(v=>v.kind==="road")).panels.map(panel=>{
    const p=panel.corners;return {p,loX:Math.min(...p.map(v=>v[0])),hiX:Math.max(...p.map(v=>v[0])),loZ:Math.min(...p.map(v=>v[1])),hiZ:Math.max(...p.map(v=>v[1]))};
  })));
}
export function blockedAt(solids, x, z, radius = WALK_RADIUS) {
  return solids.some(s => {
    if (x < s.loX - radius || x > s.hiX + radius || z < s.loZ - radius || z > s.hiZ + radius) return false;
    if (inside(x, z, s.p)) return true;
    return s.p.some((a, i) => {
      const q = nearest(x, z, a, s.p[(i + 1) % s.p.length]);
      return Math.hypot(q[0] - x, q[1] - z) <= radius;
    });
  });
}
// Sweep the whole move, including road snapping, so thin corners cannot be skipped.
export function clearMove(solids, a, b) {
  const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (WALK_RADIUS * 0.45)));
  for (let i = 1; i <= count; i++) {
    if (blockedAt(solids, a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count)) return false;
  }
  return true;
}
export function slideMove(solids, start, end, allowed = () => true) {
  if (allowed(end) && clearMove(solids, start, end)) return end;
  // Use wall tangents rather than world axes: rotated village homes slide naturally.
  const candidates = [];
  const delta = [end[0] - start[0], end[1] - start[1]], travel = Math.hypot(...delta);
  for (const s of solids) {
    if (start[0] < s.loX - travel - WALK_RADIUS || start[0] > s.hiX + travel + WALK_RADIUS ||
        start[1] < s.loZ - travel - WALK_RADIUS || start[1] > s.hiZ + travel + WALK_RADIUS) continue;
    for (let i = 0; i < s.p.length; i++) {
      const a = s.p[i], b = s.p[(i + 1) % s.p.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!length) continue;
      const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const amount = delta[0] * u[0] + delta[1] * u[1];
      candidates.push([start[0] + u[0] * amount, start[1] + u[1] * amount]);
    }
  }
  candidates.sort((a, b) => Math.hypot(b[0] - start[0], b[1] - start[1]) - Math.hypot(a[0] - start[0], a[1] - start[1]));
  return candidates.find(p => allowed(p) && clearMove(solids, start, p)) || start;
}
