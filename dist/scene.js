import { regionalExtent } from "./scene-region.js";
import { extent, features as baseline } from "./geography.js";
import {
  clamp,
  norm,
  dot,
  multiply,
  view,
  perspective,
  ortho,
  nearest,
} from "./scene-math.js";
import { createGpu } from "./scene-gpu.js?v=depth-fix-2";
import { createInset } from "./scene-inset.js";
import { navigationSolids, blockedAt, slideMove } from "./scene-collision.js";

const FOV = (44 * Math.PI) / 180;
const HALF_PI = Math.PI / 2;
const eyeHeight = 5.2;
const halfX = regionalExtent.width / 2,
  halfZ = regionalExtent.depth / 2;
const aerial = (mode) => mode === "orbit" || mode === "map";
const aliases = {
  building: "buildings",
  road: "roads",
  trees: "vegetation",
  tree: "vegetation",
  reservoir: "water",
  satellite: "imagery",
  source: "imagery",
};
function featureCenter(f) {
  const p = f.points || [];
  if (!p.length) return [0, 0];
  const xs = p.map((p) => p[0]),
    zs = p.map((p) => p[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  ];
}
export function createScene(canvas, { onSelect, onCamera, onError } = {}) {
  const listeners = new AbortController(),
    signal = listeners.signal;
  let mode = "orbit",
    target = [0, 0, 0],
    position = [0, eyeHeight, 0],
    yaw = -0.27,
    pitch = 0.75,
    distance = 1300,
    speed = 1;
  let items = baseline,
    selected = 0,
    width = 1,
    height = 1,
    quality = "high",
    dirty = true,
    alive = true,
    matrices,
    fitting = true;
  let frameId = 0,
    lastTick = 0,
    lastRender = 0,
    look = false,
    transition = null;
  const keys = new Set(),
    pointers = new Map(),
    layers = {
      buildings: true,
      roads: true,
      water: true,
      vegetation: true,
      imagery: false,
    };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gpu = createGpu(
    canvas,
    items,
    extent,
    () => {
      dirty = true;
    },
    onError,
  );
  const inset = createInset(canvas.parentNode, regionalExtent);
  inset.setFeatures(items);
  let solid = [],
    paths = [];
  function indexNavigation() {
    solid = navigationSolids(items);
    paths = items
      .filter((f) => f.kind === "road")
      .flatMap((f) =>
        f.points
          .slice(1)
          .map((b, i) => ({ a: f.points[i], b, width: f.width || 9 })),
      );
  }
  indexNavigation();
  const blocked = (x, z) => blockedAt(solid, x, z);
  function roadPoint(x, z) {
    let best = null,
      distance = Infinity;
    for (const path of paths) {
      const point = nearest(x, z, path.a, path.b),
        d = Math.hypot(point[0] - x, point[1] - z);
      if (d < distance) {
        distance = d;
        best = { point, path, d };
      }
    }
    return best;
  }
  function spawn(x, z) {
    const candidates = paths
      .map((path) => ({ path, point: nearest(x, z, path.a, path.b) }))
      .sort(
        (a, b) =>
          Math.hypot(a.point[0] - x, a.point[1] - z) -
          Math.hypot(b.point[0] - x, b.point[1] - z),
      );
    for (const { path, point } of candidates) {
      for (const p of [
        point,
        [(path.a[0] + path.b[0]) / 2, (path.a[1] + path.b[1]) / 2],
        path.a,
        path.b,
      ]) {
        if (!blocked(...p))
          return {
            point: p,
            yaw: Math.atan2(path.b[0] - path.a[0], path.a[1] - path.b[1]),
          };
      }
    }
    return null;
  }
  function eyeAndAxes() {
    const tilt = mode === "map" ? HALF_PI : pitch;
    const forward = [
      Math.sin(yaw) * Math.cos(tilt),
      -Math.sin(tilt),
      -Math.cos(yaw) * Math.cos(tilt),
    ];
    const right = [Math.cos(yaw), 0, Math.sin(yaw)];
    const eye = aerial(mode)
      ? target.map((v, i) => v - forward[i] * distance)
      : position.slice();
    return { eye, forward, right };
  }
  function camera() {
    const { eye } = eyeAndAxes();
    return {
      mode,
      x: eye[0],
      y: eye[1],
      z: eye[2],
      target: [...target],
      yaw,
      pitch,
      distance,
      heading: ((((yaw * 180) / Math.PI) % 360) + 360) % 360,
      speed,
    };
  }
  function update() {
    const { eye, forward, right } = eyeAndAxes(),
      aspect = width / height;
    gpu.setEye(eye,2*Math.tan(FOV/2)/Math.max(1,canvas.height),mode==="map"?distance:0);
    const sceneRadius=Math.hypot(halfX,halfZ)+500;
    const far=Math.hypot(...eye)+sceneRadius;
    const near=aerial(mode)
      ? clamp(distance*.02,.3,300)
      : clamp(Math.abs(eye[1])*.02,.28,100);
    const proj =
      mode === "map"
        ? ortho(distance * 2 * Math.tan(FOV / 2), aspect, Math.max(.1,distance-sceneRadius), distance+sceneRadius)
        : perspective(FOV, aspect, near, far);
    matrices = multiply(proj, view(eye, forward, right));
    dirty = true;
    const current = camera();
    inset.draw(current);
    onCamera?.(current);
  }
  function fitDistance() {
    const { forward, right } = eyeAndAxes(),
      sinTilt = Math.sin(mode === "map" ? HALF_PI : pitch);
    const up = [
      Math.sin(yaw) * sinTilt,
      Math.cos(mode === "map" ? HALF_PI : pitch),
      -Math.cos(yaw) * sinTilt,
    ];
    const corners = [
      [-extent.width/2, 0, -extent.depth/2],
      [extent.width/2, 0, -extent.depth/2],
      [extent.width/2, 0, extent.depth/2],
      [-extent.width/2, 0, extent.depth/2],
    ];
    // Centre the projected rectangle between the two sides of each frustum axis.
    // Perspective makes its near edge wider than the far edge.
    const span = (axis, slope) => {
      const lower = Math.max(
        ...corners.map(
          (p) => dot(p, axis) - slope * (mode === "map" ? 0 : dot(forward, p)),
        ),
      );
      const upper = Math.min(
        ...corners.map(
          (p) => dot(p, axis) + slope * (mode === "map" ? 0 : dot(forward, p)),
        ),
      );
      return {
        offset: (lower + upper) / 2,
        distance: (lower - upper) / (2 * slope),
      };
    };
    const tangent = Math.tan(FOV / 2) * 0.88;
    const h = span(right, (tangent * width) / height),
      v = span(up, tangent);
    const offset = right.map((n, i) => n * h.offset + up[i] * v.offset);
    const groundShift = -offset[1] / forward[1];
    target = offset.map((n, i) => n + forward[i] * groundShift);
    return Math.min(10000, Math.max(h.distance, v.distance) + groundShift);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(rect.width, 1);
    height = Math.max(rect.height, 1);
    // High quality supersamples even 1x displays and uses full Retina resolution.
    const pixelScale = quality === "high"
      ? Math.max(2, Math.min(devicePixelRatio || 1, 3))
      : Math.min(devicePixelRatio || 1, quality === "low" ? 1 : 1.5);
    const dpr = Math.min(pixelScale,
      (quality === "high" ? 5120 : 3072) / Math.max(width, height),
      Math.sqrt((quality === "high" ? 12000000 : 6000000) / (width * height)));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    if (fitting) distance = fitDistance();
    update();
  }
  function updateBackground() {
    canvas.style.background = aerial(mode)
      ? "radial-gradient(circle at center,#e9e9df 10%,#d7dacf 100%)"
      : "linear-gradient(to bottom,#aabfc2 0%,#e3e8df 47%,#c7c8b5 65%)";
    canvas.style.cursor = look ? "crosshair" : aerial(mode) ? "grab" : "move";
  }
  function fit() {
    transition = null;
    fitting = true;
    if (!aerial(mode)) mode = "orbit";
    target = [0, 0, 0];
    yaw = mode === "map" ? 0 : -0.27;
    pitch = mode === "map" ? HALF_PI : 0.75;
    distance = fitDistance();
    releaseLook();
    updateBackground();
    update();
  }
  function releaseLook() {
    look = false;
    keys.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  function setMode(next) {
    if (!["map", "orbit", "walk", "fly"].includes(next)) return;
    transition = null;
    const previous = mode,
      prevEye = eyeAndAxes().eye;
    releaseLook();
    if (next === "walk") {
      const [x, , z] = aerial(mode) ? target : position;
      const start = spawn(x, z);
      if (!start) {
        onError?.("No walkable road is available in this configuration.");
        return;
      }
      position = [start.point[0], eyeHeight, start.point[1]];
      yaw = start.yaw;
      pitch = 0.025;
    } else if (next === "fly") {
      position = prevEye.map((v, i) =>
        clamp(
          v,
          i === 1 ? 3 : i === 0 ? -halfX * 1.6 : -halfZ * 1.6,
          i === 1 ? 1800 : i === 0 ? halfX * 1.6 : halfZ * 1.6,
        ),
      );
      if (previous === "map") pitch = 1.05;
    } else {
      if (!aerial(previous)) {
        target = [
          clamp(prevEye[0], -halfX, halfX),
          0,
          clamp(prevEye[2], -halfZ, halfZ),
        ];
        distance = 370;
        fitting = false;
      }
      if (next === "map") {
        pitch = HALF_PI;
        yaw = 0;
      } else if (previous !== "orbit") pitch = 0.96;
    }
    mode = next;
    if (!aerial(next)) canvas.focus({ preventScroll: true });
    if (fitting && aerial(next)) distance = fitDistance();
    updateBackground();
    update();
  }
  function north() {
    transition = null;
    yaw = 0;
    update();
  }
  function zoom(factor) {
    if (!(factor > 0)) return;
    transition = null;
    fitting = false;
    if (aerial(mode)) distance = clamp(distance / factor, 19, 40000);
    else {
      const dir = factor > 1 ? "forward" : "back";
      for (let i = 0; i < 4; i++) step(dir, mode === "fly" ? 7 : 1);
    }
    update();
  }
  function pan(dx, dy) {
    const units = (2 * distance * Math.tan(FOV / 2)) / height;
    const sx = -dx * units,
      sz = (-dy * units) / Math.max(0.22, Math.sin(pitch));
    target[0] = clamp(
      target[0] + sx * Math.cos(yaw) - sz * Math.sin(yaw),
      -halfX,
      halfX,
    );
    target[2] = clamp(
      target[2] + sx * Math.sin(yaw) + sz * Math.cos(yaw),
      -halfZ,
      halfZ,
    );
  }
  function step(dir, amount) {
    if (aerial(mode)) return;
    const forwards =
      dir === "forward" ? 1 : dir === "back" || dir === "backward" ? -1 : 0;
    const sideways = dir === "right" ? 1 : dir === "left" ? -1 : 0;
    const vertical = dir === "up" ? 1 : dir === "down" ? -1 : 0;
    const plane = mode === "fly" ? Math.cos(pitch) : 1;
    let x =
      position[0] +
      (forwards * Math.sin(yaw) * plane + sideways * Math.cos(yaw)) * amount;
    let z =
      position[2] +
      (-forwards * Math.cos(yaw) * plane + sideways * Math.sin(yaw)) * amount;
    if (mode === "walk") {
      const road = roadPoint(x, z);
      if (!road) return;
      const radius = Math.max(0.4, road.path.width * 0.5 - 0.65);
      if (road.d > radius) {
        x = road.point[0] + ((x - road.point[0]) * radius) / road.d;
        z = road.point[1] + ((z - road.point[1]) * radius) / road.d;
      }
      const next = slideMove(solid, [position[0], position[2]], [x, z], (p) => {
        const lane = roadPoint(...p);
        return lane && lane.d <= Math.max(0.4, lane.path.width * 0.5 - 0.65) + 0.001;
      });
      position = [next[0], eyeHeight, next[1]];
    } else {
      position = [
        clamp(x, -halfX * 1.6, halfX * 1.6),
        clamp(
          position[1] + (vertical - forwards * Math.sin(pitch)) * amount,
          2,
          1900,
        ),
        clamp(z, -halfZ * 1.6, halfZ * 1.6),
      ];
    }
  }
  function move(dir) {
    const stepSize = (mode === "walk" ? 4.2 : 12) * speed;
    // Substeps preserve collision checks for touch input and higher travel speeds.
    const count = Math.ceil(stepSize / 1.4);
    for (let i = 0; i < count; i++) step(dir, stepSize / count);
    update();
  }
  function focus(f) {
    if (!f || !Array.isArray(f.points) || !f.points.length) return;
    if (!aerial(mode)) setMode("orbit");
    fitting = false;
    const [x, z] = featureCenter(f),
      px = f.points.map((p) => p[0]),
      pz = f.points.map((p) => p[1]);
    const span = Math.max(
      Math.max(...px) - Math.min(...px),
      Math.max(...pz) - Math.min(...pz),
    );
    const end = {
      target: [x, (f.height || 0) * 0.35, z],
      distance: clamp(span * 2.2, 115, f.kind === "river" ? 22000 : 1550),
    };
    if (reduced.matches) {
      target = end.target;
      distance = end.distance;
      update();
      return;
    }
    transition = {
      start: performance.now(),
      from: [...target],
      fromD: distance,
      ...end,
    };
  }
  function project(x, z, h = 0) {
    const m = matrices;
    if (!m) return { visible: false, x: 0, y: 0 };
    const at = (i) => m[i] * x + m[4 + i] * h + m[8 + i] * z + m[12 + i];
    const w = at(3),
      dx = at(0) / w,
      dy = at(1) / w,
      dz = at(2) / w;
    return {
      x: ((dx + 1) * width) / 2,
      y: ((1 - dy) * height) / 2,
      visible:
        w > 0 && Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(dz) <= 1,
    };
  }
  function selectAt(x, y) {
    const id = gpu.pick(
      matrices,
      layers,
      selected,
      lastRender / 1000,
      clamp(Math.floor((x / width) * canvas.width), 0, canvas.width - 1),
      clamp(Math.floor((1 - y / height) * canvas.height), 0, canvas.height - 1),
    );
    selected = id > 0 && id <= items.length ? id : 0;
    dirty = true;
    onSelect?.(items[selected - 1] || null);
  }
  function activateLook() {
    if (aerial(mode)) return;
    canvas.focus({ preventScroll: true });
    look = true;
    if (canvas.requestPointerLock) {
      try {
        const promise = canvas.requestPointerLock();
        promise?.catch(() => {
          look = false;
          updateBackground();
        });
      } catch {
        look = false;
      }
    }
    updateBackground();
  }
  function orient(dx, dy) {
    yaw += dx * 0.004;
    pitch = clamp(pitch + dy * 0.003, -1.48, 1.48);
  }
  const listen = (el, event, fn, opts = {}) =>
    el.addEventListener(event, fn, { ...opts, signal });
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  canvas.setAttribute(
    "aria-label",
    "Interactive 3D village. Drag to orbit, right-drag to pan, scroll to zoom.",
  );
  let pinch = null,
    gesture = false;
  function touchPair() {
    const [a, b] = pointers.values();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      span: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    };
  }
  listen(canvas, "pointerdown", (e) => {
    if (document.pointerLockElement === canvas) return;
    transition = null;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      drag: false,
      button: e.button,
    });
    if (pointers.size === 2) {
      pinch = touchPair();
      gesture = true;
    } else if (pointers.size === 1) gesture = false;
  });
  listen(canvas, "pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 3) p.drag = true;
    if (!p.drag && !pinch) return;
    fitting = false;
    if (pinch && pointers.size === 2) {
      const now = touchPair();
      if (aerial(mode)) {
        pan(now.x - pinch.x, now.y - pinch.y);
        zoom(now.span / pinch.span);
      }
      pinch = now;
    } else if (aerial(mode)) {
      if (mode === "map" || p.button === 2 || p.button === 1 || e.shiftKey)
        pan(dx, dy);
      else {
        yaw -= dx * 0.007;
        pitch = clamp(pitch + dy * 0.006, 0.16, 1.51);
      }
      canvas.style.cursor = "grabbing";
    } else orient(dx, dy);
    update();
  });
  function pointerEnd(e, cancelled) {
    const p = pointers.get(e.pointerId);
    if (p && !p.drag && !gesture && !cancelled && p.button === 0) {
      const rect = canvas.getBoundingClientRect();
      selectAt(e.clientX - rect.left, e.clientY - rect.top);
    }
    pointers.delete(e.pointerId);
    pinch = null;
    updateBackground();
  }
  listen(canvas, "pointerup", (e) => pointerEnd(e, false));
  listen(canvas, "pointercancel", (e) => pointerEnd(e, true));
  listen(canvas, "contextmenu", (e) => e.preventDefault());
  listen(
    canvas,
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(Math.exp(-clamp(e.deltaY, -180, 180) * 0.002));
    },
    { passive: false },
  );
  listen(document, "pointerlockchange", () => {
    look = document.pointerLockElement === canvas;
    keys.clear();
    updateBackground();
  });
  listen(document, "mousemove", (e) => {
    if (document.pointerLockElement === canvas && !aerial(mode)) {
      orient(e.movementX, e.movementY);
      update();
    }
  });
  const actions = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "back",
    ArrowDown: "back",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    KeyQ: "down",
    KeyE: "up",
  };
  const editing = () =>
    document.activeElement?.matches(
      'input,textarea,select,button,[contenteditable="true"]',
    ) ||
    document.querySelector('dialog[open],[aria-modal="true"]:not([hidden])');
  listen(window, "keydown", (e) => {
    if (aerial(mode) || editing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (actions[e.code] || e.code.startsWith("Shift")) {
      e.preventDefault();
      keys.add(e.code);
    }
    if (e.code === "Escape") releaseLook();
  });
  listen(window, "keyup", (e) => keys.delete(e.code));
  listen(window, "blur", () => keys.clear());
  listen(document, "visibilitychange", () => keys.clear());
  listen(canvas, "webglcontextlost", (e) => {
    e.preventDefault();
    alive = false;
    cancelAnimationFrame(frameId);
    onError?.(
      "The 3D graphics session was interrupted. Reload this page to recover the model.",
    );
  });
  function frame(time) {
    if (!alive) return;
    const dt = Math.min(0.05, (time - lastTick) / 1000 || 0);
    lastTick = time;
    if (transition) {
      const t = clamp((time - transition.start) / 500, 0, 1),
        ease = t * t * (3 - 2 * t);
      target = transition.from.map(
        (v, i) => v + (transition.target[i] - v) * ease,
      );
      distance =
        transition.fromD + (transition.distance - transition.fromD) * ease;
      if (t === 1) transition = null;
      update();
    }
    if (!aerial(mode) && keys.size && !editing()) {
      const pressed = new Set([...keys].map((k) => actions[k]).filter(Boolean));
      const delta =
        ((mode === "walk" ? 16 : 95) *
          speed *
          (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2.7 : 1) *
          dt) /
        Math.max(1, Math.sqrt(pressed.size));
      const steps = Math.max(1, Math.ceil(delta / 1.3));
      for (let i = 0; i < steps; i++)
        for (const dir of pressed) step(dir, delta / steps);
      update();
    }
    if (dirty || (!reduced.matches && layers.water && time - lastRender > 75)) {
      gpu.draw(matrices, layers, selected, reduced.matches ? 0 : time / 1000);
      dirty = false;
      lastRender = time;
    }
    frameId = requestAnimationFrame(frame);
  }
  function setCamera(b) {
    if (!b || !["orbit", "map", "walk", "fly"].includes(b.mode)) return;
    const nums = [b.yaw, b.pitch, b.distance];
    if (!nums.every(Number.isFinite)) return;
    setMode(b.mode);
    transition = null;
    fitting = false;
    if (
      Array.isArray(b.target) &&
      b.target.length === 3 &&
      b.target.every(Number.isFinite)
    )
      target = [
        clamp(b.target[0], -halfX, halfX),
        clamp(b.target[1], 0, 200),
        clamp(b.target[2], -halfZ, halfZ),
      ];
    yaw = b.yaw;
    pitch =
      mode === "map"
        ? HALF_PI
        : clamp(b.pitch, aerial(mode) ? 0.16 : -1.48, 1.51);
    distance = clamp(b.distance, 19, 40000);
    if (!aerial(mode) && [b.x, b.y, b.z].every(Number.isFinite)) {
      if (mode === "fly")
        position = [
          clamp(b.x, -halfX * 1.6, halfX * 1.6),
          clamp(b.y, 2, 1900),
          clamp(b.z, -halfZ * 1.6, halfZ * 1.6),
        ];
      else {
        const road = roadPoint(b.x, b.z);
        if (road && road.d <= road.path.width * 0.5 && !blocked(b.x, b.z))
          position = [b.x, eyeHeight, b.z];
        else {
          const start = spawn(b.x, b.z);
          if (start) position = [start.point[0], eyeHeight, start.point[1]];
        }
      }
    }
    update();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  updateBackground();
  resize();
  frameId = requestAnimationFrame(frame);
  return {
    setTankIoT(values,aux) { gpu.setTankIoT(values,aux); dirty=true; },
    setMode,
    zoom,
    fit,
    north,
    focus,
    activateLook,
    move,
    project,
    getCamera: camera,
    setCamera,
    setSelected(f) {
      selected = f
        ? items.findIndex(
            (item) => item.id === (typeof f === "string" ? f : f.id),
          ) + 1
        : 0;
      dirty = true;
    },
    setLayer(k, v) {
      layers[aliases[k] || k] = Boolean(v);
      dirty = true;
    },
    setSpeed(n) {
      if (Number.isFinite(+n)) speed = clamp(+n, 0.15, 8);
      update();
    },
    setQuality(q) {
      quality = q;
      resize();
    },
    setFeatures(features) {
      const id = items[selected - 1]?.id;
      items = features;
      selected = items.findIndex((f) => f.id === id) + 1;
      indexNavigation();
      gpu.update(items);
      inset.setFeatures(items);
      if (mode === "walk" && blocked(position[0], position[2])) setMode("walk");
      update();
    },
    destroy() {
      alive = false;
      releaseLook();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      listeners.abort();
      inset.destroy();
      gpu.destroy();
    },
  };
}
