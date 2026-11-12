import test from 'node:test';
import assert from 'node:assert/strict';
import { features, extent } from '../dist/geography.js';
import { buildMeshes } from '../dist/scene-mesh.js';
import { buildingLayout } from '../dist/scene-buildings.js';
import { navigationSolids, blockedAt, clearMove, slideMove } from '../dist/scene-collision.js';
const house = { id: 'B-test', kind: 'building', height: 12, points: [[0,0],[12,0],[12,12],[0,12]] };

test('body clearance blocks walls and corners in either polygon winding', () => {
  for (const points of [house.points, [...house.points].reverse()]) {
    const solids = navigationSolids([{...house, points}]);
    assert.equal(blockedAt(solids, -0.7, 6), true);
    assert.equal(blockedAt(solids, -0.6, -0.6), true);
    assert.equal(blockedAt(solids, -1.1, 6), false);
    assert.equal(blockedAt(solids, 6, 6), true);
  }
});
test('sweeps prevent tunnelling through a thin wall at high speed', () => {
  const solids = navigationSolids([{...house, points: [[0,0],[0.05,0],[0.05,12],[0,12]]}]);
  assert.equal(clearMove(solids, [-8,6], [8,6]), false);
  assert.equal(clearMove(solids, [-8,-2], [8,-2]), true);
});
test('diagonal approaches slide along rotated walls without clipping or leaving road', () => {
  const rotate = ([x,z]) => [(x-z)/Math.sqrt(2), (x+z)/Math.sqrt(2)];
  const solids = navigationSolids([{...house, points: house.points.map(rotate)}]);
  const start = rotate([-1.1,4]), end = rotate([0.2,6]);
  const next = slideMove(solids, start, end);
  assert.ok(Math.hypot(next[0]-start[0], next[1]-start[1]) > 1);
  assert.equal(blockedAt(solids, ...next), false);
  assert.deepEqual(slideMove(solids, start, end, () => false), start);
});
test('entrance steps share rendered layout and collide; edited footprints rebuild', () => {
  const road = {kind:'road', width:4, points:[[-5,-9],[20,-9]]};
  const items = [house, road], layout = buildingLayout(house, items);
  assert.ok(layout.steps.length);
  const p = layout.steps[0].reduce((v,p) => [v[0]+p[0]/4,v[1]+p[1]/4], [0,0]);
  assert.equal(blockedAt(navigationSolids(items), ...p), true);
  const moved = {...house, points: house.points.map(([x,z]) => [x+100,z+100])};
  const solids = navigationSolids([moved,road]);
  assert.equal(blockedAt(solids,6,6), false);
  assert.equal(blockedAt(solids,106,106), true);
});
test('all homes build finite, selectable geometry deterministically without changing geography', () => {
  const original = JSON.stringify(features), a = buildMeshes(features,extent), b = buildMeshes(features,extent);
  assert.equal(JSON.stringify(features),original);
  assert.deepEqual(a.buildings.data,b.buildings.data);
  assert.ok(a.buildings.data.every(Number.isFinite));
  const ids = new Set();
  for(let i=7;i<a.buildings.data.length;i+=8) ids.add(a.buildings.data[i]);
  assert.equal(ids.size,features.filter(f=>f.kind==='building').length);
  for(const id of ids) assert.equal(features[id-1].kind,'building');
});
