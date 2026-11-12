import { features } from "./geography.js";
import { reservoirFence } from "./scene-fence.js";

// Stage 2 climbing plants follow the exterior of each fence panel, including
// its access opening. The narrow planting strip sits between fence and road.
function plantingStrips() {
  const pond = features.find(feature => feature.kind === "water");
  const roads = features.filter(feature => feature.kind === "road");
  const center = pond.points.reduce((sum, point) => [
    sum[0] + point[0] / pond.points.length,
    sum[1] + point[1] / pond.points.length,
  ], [0, 0]);

  return reservoirFence(pond.points, roads).panels.map((panel, index) => {
    const { a, b } = panel;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let nx = (b[1] - a[1]) / length;
    let nz = -(b[0] - a[0]) / length;
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ((midpoint[0] - center[0]) * nx + (midpoint[1] - center[1]) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const offset = (point, depth) => [point[0] + nx * depth, point[1] + nz * depth];
    return {
      id: `HEDGE-${index + 1}`,
      name: "Flowering climbers along reservoir fence",
      kind: "fencePlants",
      points: [offset(a, .65), offset(b, .65), offset(b, 2.65), offset(a, 2.65)],
      source: "Stage 2 roadside planting reference",
      confidence: "Illustrative proposal",
      notes: "Dense leafy climbers supported by the fence, proposed as a roadside dust buffer.",
    };
  });
}

export const fencePlantings = plantingStrips();

export function renderFencePlants(mesh, feature, id) {
  const [a, b, , outer] = feature.points;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const columns = Math.max(2, Math.ceil(length / 1.0));
  const point = (along, height, depth) => [
    a[0] + (b[0] - a[0]) * along + (outer[0] - a[0]) * depth,
    height * 1.39,
    a[1] + (b[1] - a[1]) * along + (outer[1] - a[1]) * depth,
  ];
  const random = seed => {
    const value = Math.sin(seed * 127.1 + a[0] * 13.7 + a[1] * 4.9) * 43758.5453;
    return value - Math.floor(value);
  };

  for (let column = 0; column < columns; column++) {
    const along = (column + .5) / columns;
    const top = 5.2 + random(column + 20) * .8;
    // Slender climbing stems and trailing shoots replace the freestanding trunks.
    mesh.quad(
      point(along - .04 / length, .15, .4),
      point(along + .04 / length, .15, .4),
      point(along + .12, top, .15),
      point(along + .12 - .08 / length, top, .15),
      [.30, .28, .13], 12, id,
    );
    for (let row = 0; row < 7; row++) {
      const seed = column * 11 + row;
      const u = Math.min(.98, Math.max(.02, along + (random(seed) - .5) / columns));
      const y = .35 + row * .76 + random(seed + 40) * .48;
      const depth = .12 + random(seed + 70) * .65;
      const width = (.43 + random(seed + 90) * .30) / length;
      const height = .52 + random(seed + 110) * .35;
      const green = [.13 + random(seed + 5) * .10, .26 + random(seed + 9) * .16, .08];
      // Folded leaf pairs give the fence cover depth from either side.
      mesh.quad(point(u, y - height, depth), point(u - width, y, depth + .1),
        point(u, y + height * .6, depth), point(u + width, y, depth - .1), green, 5, id);
      mesh.quad(point(u, y - height * .6, depth), point(u, y, depth + .28),
        point(u, y + height, depth), point(u, y, depth - .28), green, 5, id);
      if (row > 2 && random(seed + 140) > .70) {
        for (let flower = 0; flower < 4; flower++) {
          const flowerU = u + (flower % 2 - .5) * .32 / length;
          const flowerY = y + Math.floor(flower / 2) * .24;
          mesh.quad(point(flowerU, flowerY - .16, depth + .14),
            point(flowerU - .17 / length, flowerY, depth + .20),
            point(flowerU, flowerY + .16, depth + .14),
            point(flowerU + .17 / length, flowerY, depth + .20),
            [.69, .16 + random(seed) * .10, .13], 12, id);
        }
      }
    }
  }
}
