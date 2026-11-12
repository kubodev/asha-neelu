// Local Cartesian coordinates have +x toward image right and +z toward image bottom.
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const norm = (a) => {
  const len = Math.hypot(...a) || 1;
  return a.map((v) => v / len);
};
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const dot = (a, b) => a.reduce((v, n, i) => v + n * b[i], 0);
export function multiply(a, b) {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
  return m;
}
export function view(eye, forward, right) {
  const up = cross(right, forward),
    back = forward.map((n) => -n);
  return [
    right[0],
    up[0],
    back[0],
    0,
    right[1],
    up[1],
    back[1],
    0,
    right[2],
    up[2],
    back[2],
    0,
    -dot(right, eye),
    -dot(up, eye),
    -dot(back, eye),
    1,
  ];
}
export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2),
    d = near - far;
  return [
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) / d,
    -1,
    0,
    0,
    (2 * far * near) / d,
    0,
  ];
}
export function ortho(height, aspect, near, far) {
  return [
    2 / (height * aspect),
    0,
    0,
    0,
    0,
    2 / height,
    0,
    0,
    0,
    0,
    -2 / (far - near),
    0,
    0,
    0,
    -(far + near) / (far - near),
    1,
  ];
}
export function inside(x, z, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[i],
      [bx, bz] = poly[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      hit = !hit;
  }
  return hit;
}
export function nearest(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = dx * dx + dz * dz;
  const t = len ? clamp(((x - a[0]) * dx + (z - a[1]) * dz) / len, 0, 1) : 0;
  return [a[0] + dx * t, a[1] + dz * t];
}
function turn(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
// Ear clipping preserves the concave shoreline as well as irregular roof footprints.
export function triangles(points) {
  const ring = points
    .map((_, i) => i)
    .filter(
      (i) =>
        i === 0 ||
        Math.hypot(
          points[i][0] - points[i - 1][0],
          points[i][1] - points[i - 1][1],
        ) > 0.001,
    );
  if (
    ring.length > 2 &&
    Math.hypot(
      points[ring.at(-1)][0] - points[0][0],
      points[ring.at(-1)][1] - points[0][1],
    ) < 0.001
  )
    ring.pop();
  const area = ring.reduce((s, id, k) => {
    const next = points[ring[(k + 1) % ring.length]];
    return s + points[id][0] * next[1] - points[id][1] * next[0];
  }, 0);
  if (area < 0) ring.reverse();
  const faces = [];
  while (ring.length > 2) {
    let clipped = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length],
        b = ring[i],
        c = ring[(i + 1) % ring.length];
      if (turn(points[a], points[b], points[c]) <= 0.00001) continue;
      if (
        ring.some(
          (j) =>
            j !== a &&
            j !== b &&
            j !== c &&
            turn(points[a], points[b], points[j]) > 0.00001 &&
            turn(points[b], points[c], points[j]) > 0.00001 &&
            turn(points[c], points[a], points[j]) > 0.00001,
        )
      )
        continue;
      faces.push([a, b, c]);
      ring.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  return faces;
}
