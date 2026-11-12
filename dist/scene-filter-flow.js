// Animated visible flow through the existing gravel/sand vessel, driven by pump state.
export function renderFilterFlow(mesh,feature,id) {
  const [x,z]=feature.points.reduce((center,p)=>[
    center[0]+p[0]/feature.points.length,center[1]+p[1]/feature.points.length,
  ],[0,0]);
  const water=[.13,.53,.68];
  function surface(left,right,near,far,height) {
    mesh.quad([x+left,height,z+near],[x+right,height,z+near],
      [x+right,height,z+far],[x+left,height,z+far],water,32,id);
  }
  function stream(cx,cz,bottom,top,radius) {
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
      mesh.quad([cx+radius*Math.cos(a),bottom,cz+radius*Math.sin(a)],
        [cx+radius*Math.cos(b),bottom,cz+radius*Math.sin(b)],
        [cx+radius*Math.cos(b),top,cz+radius*Math.sin(b)],
        [cx+radius*Math.cos(a),top,cz+radius*Math.sin(a)],water,31,id);
    }
  }
  // Gooseneck discharge falls onto the gravel inlet bed, then wets both compartments.
  stream(x-4,z-5,6.25,10.2,.32);
  surface(-7.4,-.6,-5.4,5.4,6.25);
  surface(.6,7.4,-5.4,5.4,7.0);
  // Small visible percolation paths and an inspection discharge on the sand side.
  stream(x+6.9,z+5.6,3.6,6.9,.14);
  stream(x+6.3,z+5.6,3.6,6.9,.14);
  mesh.quad([x-7.7,3.6,z+7.02],[x+7.7,3.6,z+7.02],
    [x+7.7,8,z+7.02],[x-7.7,8,z+7.02],[.31,.65,.69],33,id);
}
