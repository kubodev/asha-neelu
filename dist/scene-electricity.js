import { networkLine } from "./scene-network.js";
import { writeNameplate } from "./scene-labels.js";
import { features } from "./geography.js";
import { inside, nearest } from "./scene-math.js";

export const cabinetLabels = ["DC COMBINER BOX", "SOLAR INVERTER", "DISTRIBUTION BOX", "ESP32 CONTROLLER", "TURBIDITY SENSOR", "FLOW METER", "PH PROBE", "CHLORINE ANALYSER", "PUMP PROTECTION", "TANK LEVEL SENSOR", "LOWER LEVEL SWITCH", "AERATOR", "SUPPLY VALVE"];
const cabinetNames = ["DC Combiner Box", "Solar Inverter (DC → AC)", "Distribution Box"];
const proposal = (id,name,kind,points,extra={}) => ({id,name,kind,points,
  source:"Stage 2 solar electricity proposal",confidence:"Illustrative proposal",...extra});
const cabinets = cabinetNames.map((name,i) => {
  const x=67,z=-134+i*8;
  return proposal(`ELEC-BOX-${i+1}`,name,"electricalBox",[[x-2.5,z-2],[x+2.5,z-2],[x+2.5,z+2],[x-2.5,z+2]],{labelIndex:i,height:7});
});
const wire = (id,name,route,color=[.16,.18,.20]) => proposal(id,name,"powerCable",route.map(p=>[p[0],p[2]]),{route,color});
const pond=features.find(f=>f.id==="W-001");
// Follow the north bank below grade, resurfacing at the pump terminal.
const pumpFeed=[[69.5,3,-118],[69.5,-1.6,-118],
  ...pond.points.slice(0,14).map(([x,z])=>[x,-1.6,z+1.5]),
  [324,-1.6,-46],[324,3,-46]];
const cables = [
  wire("SOLAR-DC","Floating solar array to DC combiner",[[174,1.2,-97],[112,1.2,-125],[92,1.2,-140],[67,1.2,-140],[67,3,-134]],[.75,.20,.10]),
  wire("DC-INVERTER","DC combiner to solar inverter",[[69.5,3,-134],[72,3,-134],[72,3,-126],[69.5,3,-126]],[.75,.20,.10]),
  wire("PUMP-FEED","Distribution box to intake pump",pumpFeed),
  wire("AC-BUS","Inverter AC output to distribution box",[[69.5,3,-126],[73,3,-126],[73,3,-118],[69.5,3,-118]]),
];
const center=pond.points.reduce((c,p)=>[c[0]+p[0]/pond.points.length,c[1]+p[1]/pond.points.length],[0,0]);
const perimeter=pond.points.filter((_,i)=>i%3===0).map(([x,z])=>{
  const dx=x-center[0],dz=z-center[1],length=Math.hypot(dx,dz);
  return [x+dx/length*11,z+dz/length*11];
});
const circuits=[
  {points:perimeter},
  {points:[[64,-110],[64,-35],[100,55],[140,100],...features.find(f=>f.id==="R-005").points.map(([x,z])=>[x,z-7])]},
  {points:[[60,-102],[54,-24],[14,61],[38,139],...features.find(f=>f.id==="R-006").points.map(([x,z])=>[x+7,z])]},
];
const poles=[];
for (const [index,circuit] of circuits.entries()) {
  const locations=[];
  for(let i=0;i<circuit.points.length;i++) {
    const a=circuit.points[i];
    if(i===0) locations.push(a);
    else {
      const b=circuit.points[i-1], count=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/45);
      for(let j=1;j<=count;j++) locations.push([b[0]+(a[0]-b[0])*j/count,b[1]+(a[1]-b[1])*j/count]);
    }
  }
  const route=[];
  const obstacles=features.filter(f=>f.kind==="water"||f.kind==="building");
  const clear=([x,z])=>obstacles.every(f=>!inside(x,z,f.points)&&f.points.every((a,i)=>{
    const p=nearest(x,z,a,f.points[(i+1)%f.points.length]);
    return Math.hypot(p[0]-x,p[1]-z)>2;
  }));
  const safeLocations=locations.map(p=>{
    if(clear(p))return p;
    for(const radius of [4,8,12,18,24])for(let i=0;i<12;i++) {
      const angle=i*Math.PI/6,q=[p[0]+Math.cos(angle)*radius,p[1]+Math.sin(angle)*radius];
      if(clear(q))return q;
    }
    return null;
  }).filter(Boolean);
  safeLocations.forEach(([x,z],i)=>{
    const id=`POWER-POLE-${index+1}-${i+1}`;
    poles.push(proposal(id,"Solar-powered street light","powerPole",[[x,z]],{height:24}));
    route.push([x,23,z]);
  });
  const first=route[0];
  cables.push(wire(`FEEDER-${index+1}`,`Distribution box lighting feeder ${index+1}`,[
    [69.5,3,-118],[76,3,-118],[76,23,-118],first,
  ]));
  const sagged=[];
  route.forEach((p,i)=>{
    if(i) {
      const a=route[i-1];
      for(let j=1;j<6;j++) {
        const t=j/6;
        sagged.push([a[0]+(p[0]-a[0])*t,23-Math.sin(t*Math.PI)*1.5,a[2]+(p[2]-a[2])*t]);
      }
    }
    sagged.push(p);
  });
  cables.push(wire(`LIGHTING-CIRCUIT-${index+1}`,"Overhead street-light power line",sagged));
}
export const electricityFeatures = [...cabinets,...poles,...cables];

export function renderElectricity(mesh, feature, id) {
  const silver=[.66,.71,.74], dark=[.20,.24,.26];
  function box(x,y,z,w,h,d,color,material=12) {
    const ring=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]];
    const top=ring.map(p=>[p[0],y+h,p[2]]);
    mesh.quad(...top,color,material,id);
    for(let i=0;i<4;i++)mesh.quad(ring[i],ring[(i+1)%4],top[(i+1)%4],top[i],color.map(v=>v*(i%2?.83:.95)),material,id);
  }
  function beam(a,b,width,color) {
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
    const nx=length ? -dz/length*width : width,nz=length ? dx/length*width : 0;
    mesh.quad([a[0]-nx,a[1],a[2]-nz],[b[0]-nx,b[1],b[2]-nz],
      [b[0]+nx,b[1],b[2]+nz],[a[0]+nx,a[1],a[2]+nz],color,12,id);
    mesh.quad([a[0],a[1]-width,a[2]],[b[0],b[1]-width,b[2]],
      [b[0],b[1]+width,b[2]],[a[0],a[1]+width,a[2]],color,12,id);
  }
  if(feature.kind==="powerCable") {
    const circuit=feature.id==="PUMP-FEED"?39:feature.id.startsWith("AERATOR-")?40:/^(FEEDER|LIGHTING)/.test(feature.id)?41:36;
    networkLine(mesh,feature.route,.17,circuit,id);
    return;
  }
  const x=feature.points.reduce((s,p)=>s+p[0]/feature.points.length,0);
  const z=feature.points.reduce((s,p)=>s+p[1]/feature.points.length,0);
  if(feature.kind==="electricalBox") {
    box(x,.1,z,6,.8,5,[.56,.55,.50]);
    box(x,.9,z,5,6,4,silver);
    box(x,6.9,z,5.4,.25,4.4,[.76,.79,.81]);
    box(x,3.9,z+2.03,4.5,2.6,.1,[.56,.62,.66]);
    box(x+1.8,3.2,z+2.15,.16,.8,.18,dark);
    for(let i=0;i<5;i++)box(x,1.8+i*.23,z+2.1,2.2,.07,.12,dark);
    box(x-.8,3.3,z+2.15,.25,.25,.1,[.12,.69,.30]);
    writeNameplate(mesh,id,{x,z:z+2.16,bottom:4.6,width:4.7,height:1.75,row:feature.labelIndex});
  }
  if(feature.kind==="powerPole") {
    box(x,.1,z,1.6,.8,1.6,[.52,.52,.47]);
    box(x,.9,z,.52,23,.52,silver);
    beam([x,22,z],[x+4,22,z],.17,silver);
    box(x+4,21.7,z,2.4,.45,1.25,dark);
    box(x+4,21.5,z,2.0,.2,1.0,[1,.89,.53],22);
    box(x,23,z,3.8,.23,.35,dark);
    for(const offset of [-1.4,1.4])box(x+offset,23.2,z,.35,.5,.35,[.72,.80,.80]);
    // Soft, subtle pool of warm light on the ground beneath the fixture.
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
      mesh.tri([x+4,.26,z],[x+4+5*Math.cos(a),.26,z+5*Math.sin(a)],
        [x+4+5*Math.cos(b),.26,z+5*Math.sin(b)],[1,.87,.48],24,id);
    }
  }
}
