import { inside, nearest } from "./scene-math.js";

const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const segments = points => points.slice(1).map((b,i) => [points[i],b]);

function closestSegments(a,b,c,d) {
  const dx=b[0]-a[0], dz=b[1]-a[1], ex=d[0]-c[0], ez=d[1]-c[1];
  const cross=dx*ez-dz*ex;
  if (Math.abs(cross)>.00001) {
    const t=((c[0]-a[0])*ez-(c[1]-a[1])*ex)/cross;
    const u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/cross;
    if (t>=0 && t<=1 && u>=0 && u<=1) {
      const point=[a[0]+dx*t,a[1]+dz*t];
      return [point,point];
    }
  }
  const candidates=[[a,nearest(...a,c,d)],[b,nearest(...b,c,d)],
    [nearest(...c,a,b),c],[nearest(...d,a,b),d]];
  return candidates.sort((p,q)=>distance(...p)-distance(...q))[0];
}

function pipe(id,name,route,properties={}) {
  return {id,name,kind:"pipe",points:route.map(p=>[p[0],p[2]]),route,
    source:"Stage 2 village distribution proposal",confidence:"Illustrative proposal",
    radius:.55,...properties};
}
const raised = point => [point[0],1.4,point[1]];

export function distributionPipes(features) {
  const mainRoad=features.find(f=>f.id==="R-001");
  const reservoir=features.find(f=>f.id==="W-001");
  const tank=features.find(f=>f.id==="TANK-001");
  if (!tank || !mainRoad || !reservoir) return [];
  const buildingCenter = feature => feature.points.reduce((sum,p)=>[
    sum[0]+p[0]/feature.points.length,sum[1]+p[1]/feature.points.length,
  ],[0,0]);
  // The traced main road runs west to east. Compare each point with the road
  // at its x coordinate, retaining the side containing the reservoir.
  const roadHeightAt = x => {
    const edges=segments(mainRoad.points);
    const [a,b]=edges.find(([a,b])=>x>=a[0] && x<=b[0]) ||
      (x<mainRoad.points[0][0] ? edges[0] : edges.at(-1));
    const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0] || 1)));
    return a[1]+(b[1]-a[1])*t;
  };
  const pondCenter=buildingCenter(reservoir);
  const direction=Math.sign(pondCenter[1]-roadHeightAt(pondCenter[0])) || 1;
  const side = point => (point[1]-roadHeightAt(point[0]))*direction;
  const margin=(mainRoad.width || 26)/2+1;
  const roads=[];
  for (const road of features.filter(f=>f.kind==="road")) {
    if(road===mainRoad) {
      roads.push({...road,points:road.points.map(([x,z])=>[x,z+direction*margin])});
      continue;
    }
    let run=[];
    const finish=()=>{
      if(run.length>1) roads.push({...road,id:`${road.id}-${roads.length}`,points:run});
      run=[];
    };
    for(const [a,b] of segments(road.points)) {
      const keepA=side(a)>=margin, keepB=side(b)>=margin;
      if(keepA && !run.length)run.push(a);
      if(keepA!==keepB) {
        let low=0,high=1;
        for(let i=0;i<30;i++) {
          const t=(low+high)/2,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
          if((side(p)>=margin)===keepA)low=t;
          else high=t;
        }
        const t=(low+high)/2;
        run.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
        if(keepA)finish();
      }
      if(keepB)run.push(b);
    }
    finish();
  }
  const houses=features.filter(f=>f.kind==="building" && side(buildingCenter(f))>0);
  const center=tank.points.reduce((sum,p)=>[sum[0]+p[0]/tank.points.length,sum[1]+p[1]/tank.points.length],[0,0]);
  const pipes=roads.map(road=>pipe(`MAIN-${road.id}`,`Distribution main · ${road.name}`,road.points.map(raised)));

  // Connect every road main into one network, including lanes whose traced
  // endpoints stop just short of a junction. Crossings use exact intersections.
  const connected=new Set([roads[0]]);
  let junction=0;
  while(connected.size<roads.length) {
    let best=null;
    for(const from of connected)for(const to of roads) {
      if(connected.has(to))continue;
      for(const [a,b] of segments(from.points))for(const [c,d] of segments(to.points)) {
        const pair=closestSegments(a,b,c,d), length=distance(...pair);
        if(!best || length<best.length) best={to,pair,length};
      }
    }
    if(best.length>.01) pipes.push(pipe(`MAIN-LINK-${++junction}`,"Road main junction",best.pair.map(raised)));
    connected.add(best.to);
  }

  const roadEdges=roads.flatMap(road=>segments(road.points));
  const nearestRoad = point => roadEdges.map(([a,b])=>nearest(...point,a,b))
    .sort((a,b)=>distance(a,point)-distance(b,point))[0];
  const outlet=[center[0]+14,center[1]];
  const junctionPoint=nearestRoad(outlet);
  pipes.push(pipe("PIPE-002","Storage tank outlet to village distribution network",[
    [center[0]+5.3,14,center[1]],[outlet[0],14,outlet[1]],
    raised(outlet),raised(junctionPoint),
  ],{radius:.75}));

  for(const house of houses) {
    // Prefer the closest wall facing a road, ending on the exterior wall.
    const candidates=[];
    for(const [a,b] of segments([...house.points,house.points[0]])) {
      for(const [c,d] of roadEdges) {
        const [wall,road]=closestSegments(a,b,c,d);
        candidates.push({wall,road,length:distance(wall,road)});
      }
    }
    candidates.sort((a,b)=>a.length-b.length);
    const obstacles=features.filter(f=>(f.kind==="building" && f!==house)||f.kind==="water");
    const clear = (a,b) => {
      const steps=Math.max(2,Math.ceil(distance(a,b)/.7));
      for(let i=1;i<steps;i++) {
        const t=i/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        if(obstacles.some(f=>inside(x,z,f.points)))return false;
      }
      return true;
    };
    const best=candidates.find(c=>clear(c.road,c.wall)) || candidates[0];
    const route=[raised(best.road),raised(best.wall),[best.wall[0],3.5,best.wall[1]]];
    pipes.push(pipe(`SERVICE-${house.id}`,`Water connection · ${house.name}`,route,{
      buildingId:house.id,notes:"Branch from the connected road main to the building exterior.",radius:.38,
    }));
  }
  return pipes;
}
