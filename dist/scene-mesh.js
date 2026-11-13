import { renderFilterFlow } from "./scene-filter-flow.js";
import { renderIoT } from "./scene-iot.js";
import { renderElectricity } from "./scene-electricity.js";
import { regionalExtent } from "./scene-region.js";
import { triangles, norm } from "./scene-math.js";
import { waterAppearance } from "./water.js";
import { buildingLayout, renderBuilding } from "./scene-buildings.js";
import { reservoirFence } from "./scene-fence.js";
import { renderFencePlants } from "./scene-flowers.js";
import { renderWaterSystem } from "./scene-water-system.js";

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
const sun = norm([-0.55, 0.88, -0.48]);
function buildingShadow(shadow, f) {
  const pts = f.points, h = f.height || 14;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    shadow.quad(
      [a[0], 0.14, a[1]], [c[0], 0.14, c[1]],
      [c[0] + h * 0.61, 0.14, c[1] + h * 0.4],
      [a[0] + h * 0.61, 0.14, a[1] + h * 0.4],
      [0.25, 0.24, 0.18], 6, 0,
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
// The footprint axes follow the long bank. Each panel tilts on its own floats.
function floatingArray(mesh, feature, id) {
  const [origin, end, , side] = feature.points;
  const { columns, rows } = feature;
  const point = (u, v, y) => [
    origin[0] + u * (end[0] - origin[0]) + v * (side[0] - origin[0]), y,
    origin[1] + u * (end[1] - origin[1]) + v * (side[1] - origin[1]),
  ];
  const frame = [0.57, 0.64, 0.66], grid = [0.36, 0.48, 0.66];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const vertex = (x, z, y) => point((column + x) / columns, (row + z) / rows, y);
      const face = (x0, x1, z0, z1, height, color) => mesh.quad(
        vertex(x0,z0,height(z0)), vertex(x1,z0,height(z0)),
        vertex(x1,z1,height(z1)), vertex(x0,z1,height(z1)), color, 12, id);
      const slope = z => 1.12 + z * 1.35;
      for (const z of [0.10, 0.73]) {
        const floatColor = [0.23, 0.27, 0.26];
        face(0.025, 0.975, z, z + 0.16, () => 0.84, floatColor);
        for (const edge of [z, z + 0.16]) {
          mesh.quad(vertex(0.025,edge,0.27), vertex(0.975,edge,0.27),
            vertex(0.975,edge,0.84), vertex(0.025,edge,0.84), floatColor, 12, id);
        }
        for (const x of [0.13, 0.84]) {
          mesh.quad(vertex(x,z,0.84), vertex(x+0.035,z,0.84),
            vertex(x+0.035,z,slope(z)), vertex(x,z,slope(z)), frame, 12, id);
        }
      }
      face(0.015, 0.985, 0.075, 0.92, slope, frame);
      const glass = z => slope(z) + 0.018;
      face(0.035, 0.965, 0.095, 0.90, glass, [0.075,0.18,0.38]);
      const trace = z => glass(z) + 0.015;
      for (let i = 1; i < 4; i++) face(i/4-0.004,i/4+0.004,0.095,0.90,trace,grid);
      for (let i = 1; i < 6; i++) {
        const z = 0.095 + 0.805 * i / 6;
        face(0.035,0.965,z-0.003,z+0.003,trace,grid);
      }
    }
  }
}

export function buildMeshes(features, extent) {
  const ground = batch(),
    land = batch(),
    buildings = batch(),
    outlines = batch(),
    roads = batch(),
    water = batch(),
    fence = batch(),
    solar = batch(),
    waterSystem = batch(),
    blueprint = batch(),
    electrical = batch(),
    filterFlow = batch(),
    fencePlants = batch(),
    shadows = batch(),
    canopyShadows = batch(),
    instances = [];
  const w = extent.width / 2,
    d = extent.depth / 2;
  const rw = regionalExtent.width / 2, rd = regionalExtent.depth / 2;
  // Surround the village tile with disjoint ground panels to prevent depth flicker.
  const sand=[.68,.58,.43];
  ground.quad([-rw,0,-rd],[rw,0,-rd],[rw,0,-d],[-rw,0,-d],sand,18,0);
  ground.quad([-rw,0,d],[rw,0,d],[rw,0,rd],[-rw,0,rd],sand,18,0);
  ground.quad([-rw,0,-d],[-w,0,-d],[-w,0,d],[-rw,0,d],sand,18,0);
  ground.quad([w,0,-d],[rw,0,-d],[rw,0,d],[w,0,d],sand,18,0);
  ground.quad([-w,0,-d],[w,0,-d],[w,0,d],[-w,0,d],[1,1,1],1,0);
  features.forEach((f, i) => {
    const id = i + 1,
      pts = f.points;
    if (!Array.isArray(pts) || !pts.length) return;
    if (f.kind === "land")
      land.polygon(pts, 0.08, rgb(f.color, "#877e62"), f.id === "P-005" ? 8.1 : 8, id);
    if (f.kind === "building") {
      renderBuilding(buildings, f, id, buildingLayout(f, features));
      // Retain the original footprint shadows and selection outlines.
      buildingShadow(shadows, f);
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
      roads.ribbon(pts, f.width || 9, 0.22, rgb(f.color, "#a39d8c"), f.surface === "Paved" ? 15 : 16, id);
    }
    if (f.kind==="powerPole" || f.deviceType==="aerator") {
      const [x,z]=pts[0],lamp=f.kind==="powerPole";
      // Local coordinates give the lamp halo and aerator ripples soft edges.
      for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]) {
        const point=lamp?[x+4,21.55,z]:[x+u*7,.28,z+v*9];
        filterFlow.data.push(...point,u,v,0,lamp?42:43,id);
      }
    }
    if (f.kind === "filter") renderFilterFlow(filterFlow, f, id);
    if (f.kind === "iotDevice") renderIoT(electrical, f, id);
    if (["electricalBox", "powerPole", "powerCable"].includes(f.kind))
      renderElectricity(electrical, f, id);
    if (f.kind === "fencePlants") renderFencePlants(fencePlants, f, id);
    if (f.kind === "river") {
      water.polygon(pts, .08, [.10,.37,.48], 19, id);
      land.ribbon([...pts,pts[0]], 34, .02, [.68,.58,.43], 18, id);
    }
    if (f.kind === "pipe" && f.underground) {
      let travelled=0;
      // Surface overlay indicates the buried route with evenly spaced blueprint dashes.
      for (let i=1;i<f.route.length;i++) {
        const a=f.route[i-1], b=f.route[i];
        const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
        for (let start=0;start<length;start+=34) {
          const end=Math.min(start+21,length);
          const at=distance=>[
            a[0]+(b[0]-a[0])*distance/length,
            a[2]+(b[2]-a[2])*distance/length,
          ];
          blueprint.ribbon([at(start),at(end)],f.blueprintWidth,.3,[travelled+start,0,0],21,id);
        }
        travelled+=length;
      }
    }
    if (f.kind === "solar") floatingArray(solar, f, id);
    if (["raft", "pump", "filter", "storage", "pipe"].includes(f.kind))
      renderWaterSystem(waterSystem, f, id);
    if (f.kind === "water") {
      const rail = [0.19,0.23,0.22], metal=[0.31,0.37,0.35];
      const layout=reservoirFence(pts,features.filter(v=>v.kind==="road"));
      for(const panel of layout.panels){
        const [a,c,d,e]=panel.corners;
        const post=(p,w)=>{const q=[p[0]-w,p[1]-w],r=[p[0]+w,p[1]-w],s=[p[0]+w,p[1]+w],t=[p[0]-w,p[1]+w];fence.quad([q[0],.1,q[1]],[r[0],.1,r[1]],[r[0],7.5,r[1]],[q[0],7.5,q[1]],metal,12,id);fence.quad([r[0],.1,r[1]],[s[0],.1,s[1]],[s[0],7.5,s[1]],[r[0],7.5,r[1]],metal,12,id);fence.quad([s[0],.1,s[1]],[t[0],.1,t[1]],[t[0],7.5,t[1]],[s[0],7.5,s[1]],metal,12,id);fence.quad([t[0],.1,t[1]],[q[0],.1,q[1]],[q[0],7.5,q[1]],[t[0],7.5,t[1]],metal,12,id);};
        post(a,.48);post(c,.48);
        const segment=Math.hypot(c[0]-a[0],c[1]-a[1]),count=Math.max(1,Math.ceil(segment/2.1));
        const point=(t,side=0)=>[a[0]+(c[0]-a[0])*t-(c[1]-a[1])/segment*side,a[1]+(c[1]-a[1])*t+(c[0]-a[0])/segment*side];
        const bar=(t,y0,y1,w=.13)=>{const p=point(t),q=[p[0]-w,p[1]-w],r=[p[0]+w,p[1]-w],s=[p[0]+w,p[1]+w],v=[p[0]-w,p[1]+w];fence.quad([q[0],y0,q[1]],[r[0],y0,r[1]],[r[0],y1,r[1]],[q[0],y1,q[1]],metal,12,id);fence.quad([s[0],y0,s[1]],[v[0],y0,v[1]],[v[0],y1,v[1]],[s[0],y1,s[1]],metal,12,id);};
        for(let j=1;j<count;j++)bar(j/count,.2,7.3,.18);
        for(const y of [1.0,6.65]){const m0=point(0),m1=point(1);fence.quad([m0[0],y,m0[1]],[m1[0],y,m1[1]],[m1[0],y+.55,m1[1]],[m0[0],y+.55,m0[1]],rail,12,id);}
      }
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
          [0.28, 0.24, 0.16],
          17,
          id,
        );
        water.quad(
          profile(a, 3.4, 1.05),
          profile(b, 3.4, 1.05),
          profile(b, bankWidth, 0.09),
          profile(a, bankWidth, 0.09),
          [0.31, 0.26, 0.17],
          17,
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
    fence,
    solar,
    waterSystem,
    blueprint,
    electrical,
    filterFlow,
    fencePlants,
    shadows,
    canopyShadows,
    tree: treeTemplate(),
    instances,
  };
}
