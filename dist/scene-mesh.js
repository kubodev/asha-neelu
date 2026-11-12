import { triangles, norm } from "./scene-math.js";
import { waterAppearance } from "./water.js";

function rgb(color, fallback) {
  if (typeof color !== "string" || !/^#[a-f\d]{6}$/i.test(color))
    color = fallback;
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
}
const shade = (c, n) => c.map((v) => Math.min(1, v * n));
function batch() {
  const data = [];
  function tri(a, b, c, color, mat, id) {
    for (const p of [a, b, c]) data.push(...p, ...color, mat, id);
  }
  function quad(a, b, c, d, color, mat, id) {
    tri(a, b, c, color, mat, id);
    tri(a, c, d, color, mat, id);
  }
  function polygon(points, y, color, mat, id) {
    for (const t of triangles(points))
      tri(...t.map((i) => [points[i][0], y, points[i][1]]), color, mat, id);
  }
  function ribbon(points, width, y, color, mat, id) {
    const edges = points.map((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const d = Math.hypot(b[1] - a[1], b[0] - a[0]) || 1,
        x = (((b[1] - a[1]) / d) * width) / 2,
        z = (((a[0] - b[0]) / d) * width) / 2;
      return [
        [p[0] + x, y, p[1] + z],
        [p[0] - x, y, p[1] - z],
      ];
    });
    for (let i = 1; i < edges.length; i++)
      quad(...edges[i - 1], edges[i][1], edges[i][0], color, mat, id);
  }
  return { data, tri, quad, polygon, ribbon };
}
const cream = rgb("#dad5c5", "#dad5c5");
const sun = norm([-0.55, 0.88, -0.48]);
const wallColor = rgb("#c3bca9", "#c3bca9");
function building(b, shadow, f, id) {
  const pts = f.points,
    h = f.height || 14,
    col = rgb(f.color, "#b6b1a2");
  b.polygon(pts, h, shade(col, 1.08), 9, id);
  // A low roof rim represents the simplified flat-roof construction in the references.
  b.ribbon([...pts, pts[0]], 0.65, h + 0.16, shade(cream, 0.93), 3, id);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      c = pts[(i + 1) % pts.length],
      dx = c[0] - a[0],
      dz = c[1] - a[1];
    const len = Math.hypot(dx, dz) || 1,
      k = 0.84 + 0.32 * ((-dz / len) * sun[0] + (dx / len) * sun[2]);
    const v = (p, y) => [p[0], y, p[1]];
    b.quad(v(a, 0.1), v(c, 0.1), v(c, h), v(a, h), shade(wallColor, k), 3, id);
    b.quad(
      v(a, h - 0.7),
      v(c, h - 0.7),
      v(c, h + 0.15),
      v(a, h + 0.15),
      shade(cream, k + 0.1),
      3,
      id,
    );
    shadow.quad(
      v(a, 0.14),
      v(c, 0.14),
      [c[0] + h * 0.61, 0.14, c[1] + h * 0.4],
      [a[0] + h * 0.61, 0.14, a[1] + h * 0.4],
      [0.25, 0.24, 0.18],
      6,
      0,
    );
  }
}
// A common crown mesh is instanced at vegetation locations derived from the reference.
function treeTemplate() {
  const out = batch();
  function sph(cx, cy, cz, rx, ry, rz, color, phase) {
    const rows = 5,
      sides = 8;
    const point = (i, j) => {
      const theta = (Math.PI * i) / rows,
        phi = (j * 2 * Math.PI) / sides + phase + (i % 2) * 0.27;
      const ripple = 1 + 0.09 * Math.sin(phi * 3 + theta * 4 + phase);
      return [
        cx + Math.sin(theta) * Math.cos(phi) * rx * ripple,
        cy + Math.cos(theta) * ry,
        cz + Math.sin(theta) * Math.sin(phi) * rz * ripple,
      ];
    };
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < sides; j++) {
        const a = point(i, j),
          b = point(i + 1, j),
          c = point(i + 1, j + 1),
          d = point(i, j + 1);
        const n = norm([
          (a[0] + b[0] + c[0]) / 3 - cx,
          (a[1] + b[1] + c[1]) / 3 - cy,
          (a[2] + b[2] + c[2]) / 3 - cz,
        ]);
        const k =
          0.78 +
          0.25 *
            Math.max(
              0,
              n.reduce((s, v, j) => s + v * sun[j], 0),
            );
        out.quad(a, b, c, d, shade(color, k), 5, 0);
      }
  }
  const bark = rgb("#75644e", "#75644e");
  for (let j = 0; j < 5; j++) {
    const a = (2 * Math.PI * j) / 5,
      b = (2 * Math.PI * (j + 1)) / 5;
    out.quad(
      [0.043 * Math.cos(a), 0, 0.043 * Math.sin(a)],
      [0.043 * Math.cos(b), 0, 0.043 * Math.sin(b)],
      [0.028 * Math.cos(b), 0.64, 0.028 * Math.sin(b)],
      [0.028 * Math.cos(a), 0.64, 0.028 * Math.sin(a)],
      bark,
      3,
      0,
    );
  }
  const leaves = rgb("#666f49", "#666f49");
  sph(-0.13, 0.64, -0.1, 0.35, 0.25, 0.34, leaves, 0.4);
  sph(0.14, 0.66, 0.06, 0.33, 0.29, 0.35, leaves, 2.8);
  sph(-0.07, 0.78, 0.05, 0.34, 0.22, 0.32, shade(leaves, 1.07), 1.3);
  return out;
}
export function buildMeshes(features, extent) {
  const ground = batch(),
    land = batch(),
    buildings = batch(),
    outlines = batch(),
    roads = batch(),
    water = batch(),
    shadows = batch(),
    canopyShadows = batch(),
    instances = [];
  const w = extent.width / 2,
    d = extent.depth / 2;
  ground.quad([-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [1, 1, 1], 1, 0);
  const corners = [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    ground.quad(
      [a[0], 0, a[1]],
      [b[0], 0, b[1]],
      [b[0], -5, b[1]],
      [a[0], -5, a[1]],
      [0.49, 0.47, 0.4],
      2,
      0,
    );
  }
  features.forEach((f, i) => {
    const id = i + 1,
      pts = f.points;
    if (!Array.isArray(pts) || !pts.length) return;
    if (f.kind === "land")
      land.polygon(pts, 0.08, rgb(f.color, "#877e62"), 8, id);
    if (f.kind === "building") {
      building(buildings, shadows, f, id);
      outlines.ribbon(
        [...pts, pts[0]],
        1.45,
        (f.height || 14) + 0.22,
        [0.26, 0.28, 0.23],
        2,
        id,
      );
    }
    if (f.kind === "road") {
      roads.ribbon(pts, (f.width || 9) + 1.8, 0.17, [0.57, 0.51, 0.42], 7, id);
      roads.ribbon(pts, f.width || 9, 0.22, rgb(f.color, "#a39d8c"), 7, id);
    }
    if (f.kind === "water") {
      const bankWidth = waterAppearance(f).bankWidth;
      water.polygon(pts, 0.27, rgb(f.color, "#343f40"), 4, id);
      // A shallow perimeter profile records the bank without inferring reservoir depth.
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length,
        cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const profile = (p, dist, y) => {
        const dx = p[0] - cx,
          dz = p[1] - cz,
          len = Math.hypot(dx, dz) || 1;
        return [p[0] + (dx * dist) / len, y, p[1] + (dz * dist) / len];
      };
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        water.quad(
          profile(a, 0, 0.26),
          profile(b, 0, 0.26),
          profile(b, 3.4, 1.05),
          profile(a, 3.4, 1.05),
          [0.48, 0.45, 0.33],
          7,
          id,
        );
        water.quad(
          profile(a, 3.4, 1.05),
          profile(b, 3.4, 1.05),
          profile(b, bankWidth, 0.09),
          profile(a, bankWidth, 0.09),
          [0.46, 0.45, 0.34],
          7,
          id,
        );
      }
    }
    if (f.kind === "tree") {
      const [x, z] = pts[0],
        w = f.width || 18,
        h = f.height || 24;
      instances.push(x, z, w, h, id);
      const ring = Array.from({ length: 10 }, (_, i) => {
        const a = (2 * Math.PI * i) / 10;
        return [
          x + h * 0.22 + w * 0.44 * Math.cos(a),
          z + h * 0.14 + w * 0.37 * Math.sin(a),
        ];
      });
      canopyShadows.polygon(ring, 0.15, [0.17, 0.22, 0.13], 6, 0);
    }
  });
  return {
    ground,
    land,
    buildings,
    outlines,
    roads,
    water,
    shadows,
    canopyShadows,
    tree: treeTemplate(),
    instances,
  };
}
