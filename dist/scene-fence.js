import { nearest } from "./scene-math.js";

// Light illustrative grill fence set just outside the modeled shoreline.
// A single road-side opening leaves a practical path to the bank.
export function reservoirFence(points, roads = []) {
  if (!points || points.length < 3) return { panels: [], opening: null };
  const center = points.reduce(([x,z],p) => [x+p[0]/points.length,z+p[1]/points.length],[0,0]);
  const ring = points.map(([x,z]) => {
    const dx=x-center[0], dz=z-center[1], n=Math.hypot(dx,dz)||1;
    return [x+dx/n*4.8,z+dz/n*4.8];
  });
  let opening=null, best=Infinity;
  for (const road of roads) for(let i=1;i<road.points.length;i++) {
    const a=road.points[i-1], b=road.points[i];
    for(let j=0;j<ring.length;j++) {
      const q=nearest(a[0],a[1],ring[j],ring[(j+1)%ring.length]);
      const d=Math.hypot(a[0]-q[0],a[1]-q[1]);
      if(d<best){
        best=d;
        const end=ring[(j+1)%ring.length], dx=end[0]-ring[j][0], dz=end[1]-ring[j][1];
        const t=((q[0]-ring[j][0])*dx+(q[1]-ring[j][1])*dz)/(dx*dx+dz*dz||1);
        opening={edge:j,t:Math.max(0,Math.min(1,t))};
      }
    }
  }
  const panels=[];
  for(let i=0;i<ring.length;i++) {
    const a=ring[i], b=ring[(i+1)%ring.length], dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<1)continue;
    const gap=opening?.edge===i?Math.min(8,10/len):0;
    const cuts=Array.from({length:Math.ceil(len/13)+1},(_,j)=>j/Math.ceil(len/13));
    if(gap){cuts.push(Math.max(0,opening.t-gap/2),Math.min(1,opening.t+gap/2));cuts.sort((x,y)=>x-y);}
    for(let j=1;j<cuts.length;j++) {
      const t0=cuts[j-1],t1=cuts[j],mid=(t0+t1)/2;
      if(gap&&Math.abs(mid-opening.t)<gap/2-.0001)continue;
      if((t1-t0)*len<.35)continue;
      const p=(t,side=0)=>[a[0]+dx*t-dz/len*side,a[1]+dz*t+dx/len*side];
      panels.push({a:p(t0),b:p(t1),corners:[p(t0,-.45),p(t1,-.45),p(t1,.45),p(t0,.45)]});
    }
  }
  return {panels,opening};
}
