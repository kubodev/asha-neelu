import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {roadRoute} from "../dist/scene-residents.js";

test("traffic follows the actual road length, heading and lane offset at bends",()=>{
  const road=roadRoute({points:[[0,0],[10,0],[10,0],[10,8]]});
  assert.equal(road.length,18);
  assert.deepEqual(road.at(4,-2),[4,-2,Math.PI/2]);
  assert.deepEqual(road.at(-3,2,true),[8,5,Math.PI]);
});
test("local actor assets contain valid indexed geometry and two-joint skin weights",()=>{
  for(const name of ["resident","village-car","water-pot"]){
    const b=readFileSync(new URL("../dist/assets/"+name+".mesh",import.meta.url));
    const n=b.readUInt32LE(),count=b.readUInt32LE(4);
    assert.equal(b.length,8+n*32+count*2);
    for(let i=0;i<n;i++){
      const encoded=b.readFloatLE(8+i*32+28);
      assert.ok(Math.floor(encoded/16)<10 && Math.floor(encoded)%16<10);
    }
    for(let j=0;j<count;j++)assert.ok(b.readUInt16LE(8+n*32+j*2)<n);
  }
});

test("aquaculture retains the village systems, keeps the school in the pond and the pump feed off the main road",async()=>{
  const {applyEdits,empty}=await import("../dist/configuration.js");
  const {inside,nearest}=await import("../dist/scene-math.js");
  const {fishPose}=await import("../dist/aquaculture.js");
  const two=applyEdits(empty(),2),three=applyEdits(empty(),3);
  const ids=new Set(three.map(f=>f.id));
  assert.ok(two.every(f=>ids.has(f.id)));
  const [cx,cz]=three.find(f=>f.kind==="fishery").points[0],pond=three.find(f=>f.kind==="water");
  for(let t=0;t<240;t+=.5)for(let i=0;i<13;i++){
    const [x,z]=fishPose(i,t);
    assert.ok(inside(cx+x,cz+z,pond.points));
  }
  const road=three.find(f=>f.id==="R-001"), route=three.find(f=>f.id==="PUMP-FEED").route;
  for(let i=1;i<route.length;i++)for(let t=0;t<=1;t+=.1){
    const p=route[i].map((n,j)=>route[i-1][j]+(n-route[i-1][j])*t);
    for(let k=1;k<road.points.length;k++){
      const [x,z]=nearest(p[0],p[2],road.points[k-1],road.points[k]);
      assert.ok(Math.hypot(x-p[0],z-p[2])>road.width/2);
    }
  }
});
