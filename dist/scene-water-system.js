// Stage 2 concept geometry, positioned in the open eastern half of the reservoir.
const proposal = (id, name, kind, points, extra = {}) => ({
  id, name, kind, points, source: "Sociathon concept reference",
  confidence: "Illustrative proposal", ...extra,
});
export const waterSystemFeatures = [
  ...[
    [276,-54], [299,-29], [266,-11], [288,15], [251,39], [218,52],
    [110,-115], [150,-115], [210,-95], [110,-75], [250,-75], [130,-35],
    [249,65], [185,57], [281,41], [161,33], [193,33], [201,17],
  ].map(([x,z],i) => {
    const a=40*Math.PI/180, u=[Math.cos(a)*13,Math.sin(a)*13], v=[-Math.sin(a)*6,Math.cos(a)*6];
    return proposal(`F-${i+1}`, "Bamboo raft with aquatic plants", "raft", [
      [x-u[0]-v[0],z-u[1]-v[1]], [x+u[0]-v[0],z+u[1]-v[1]],
      [x+u[0]+v[0],z+u[1]+v[1]], [x-u[0]+v[0],z-u[1]+v[1]],
    ]);
  }),
  proposal("PUMP-001", "Solar water pump", "pump", [[318,-52],[332,-52],[332,-38],[318,-38]]),
  proposal("FILTER-001", "Sand and gravel filtration tank", "filter", [[326,-23],[344,-23],[344,-9],[326,-9]]),
  proposal("TANK-001", "Main storage and overflow collection tanks", "storage", [[320,9],[334,9],[334,23],[320,23]], {
    notes: "The upper storage tank drains overflow through a dedicated pipe into the covered lower collection tank. A public tap on the lower tank faces the access road.",
  }),
  ...[[[303,1.4,96],[316,1.4,101],[316,4,101]],[[166,1.4,175],[160,1.4,191],[160,4,191]],[[73,1.4,143],[79,1.4,129],[79,4,129]]].map((route,i)=>proposal(`BRANCH-${i+1}`,"Household water connection","pipe",route.map(p=>[p[0],p[2]]),{route})),
  proposal("PIPE-001", "Pump, filtration and storage connections", "pipe", [[318,-46],[313,-46],[313,-50],[318,-50]], { route: [[313,.35,-50],[313,2.3,-50],[324,2.3,-50],[324,5,-44],[337,5,-44],[337,5,-24],[337,10.2,-24],[331,10.2,-24],[331,10.2,-21]] }),
  proposal("FILTER-OUT-001", "Filtered water outlet to storage", "pipe", [[341,-16],[346,-16],[327,16]], {
    route:[[341,4.5,-16],[346,4.5,-16],[346,20,-16],[333,20,-16],[333,20,16],[327,20,16]],
  }),
  proposal("PIPE-002", "Water distribution to village homes", "pipe", [[327,16],[340,28]], { route: [[327,14,16],[341,14,16],[341,1.4,28],[303,1.4,96],[265,1.4,159],[243,1.4,204],[205,1.4,188],[166,1.4,175],[119,1.4,158],[73,1.4,143],[24,1.4,127]] }),
];

export function renderWaterSystem(mesh, feature, id) {
  const metal=[.28,.34,.34], bamboo=[.58,.48,.24], blue=[.06,.60,.88];
  const points=feature.points;
  const center=points.reduce((c,p)=>[c[0]+p[0]/points.length,c[1]+p[1]/points.length],[0,0]);
  const vertex=(x,y,z)=>[center[0]+x,y,center[1]+z];
  const quad=(a,b,c,d,color)=>mesh.quad(a,b,c,d,color,12,id);
  function box(x,y,z,w,h,d,color) {
    const p=[vertex(x-w/2,y,z-d/2),vertex(x+w/2,y,z-d/2),vertex(x+w/2,y,z+d/2),vertex(x-w/2,y,z+d/2)];
    const top=p.map(v=>[v[0],v[1]+h,v[2]]);
    quad(...top,color);
    for(let i=0;i<4;i++)quad(p[i],p[(i+1)%4],top[(i+1)%4],top[i],color.map(v=>v*(i%2?.85:.95)));
  }
  function beam(a,b,r,color,sides=8) {
    const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta);
    if(length<.001)return;
    const n=delta.map(v=>v/length), ref=Math.abs(n[1])<.9?[0,1,0]:[1,0,0];
    const u=[n[1]*ref[2]-n[2]*ref[1],n[2]*ref[0]-n[0]*ref[2],n[0]*ref[1]-n[1]*ref[0]];
    const ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;
    const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
    const ring=(p,j)=>p.map((value,i)=>value+r*(u[i]*Math.cos(j*2*Math.PI/sides)+v[i]*Math.sin(j*2*Math.PI/sides)));
    for(let j=0;j<sides;j++) {
      const colorSide=color.map(value=>value*(.8+.2*(.5+.5*Math.cos(j*2*Math.PI/sides))));
      quad(ring(a,j),ring(b,j),ring(b,j+1),ring(a,j+1),colorSide);
      mesh.tri(a,ring(a,j+1),ring(a,j),colorSide,12,id);
      mesh.tri(b,ring(b,j),ring(b,j+1),colorSide,12,id);
    }
  }
  if(feature.kind==="pipe") {
    if (feature.underground) return;
    const route=feature.route;
    for(let i=1;i<route.length;i++)beam(route[i-1],route[i],feature.radius || .47,blue);
    for(const p of route)beam([p[0],p[1]-.58,p[2]],[p[0],p[1]+.58,p[2]],feature.radius ? feature.radius*1.2 : .62,[.22,.73,.88]);
    return;
  }
  if(feature.kind==="raft") {
    const [a,b,,d]=points;
    const at=(u,v,y)=>[a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v,y,a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v];
    for(const t of [0,.04,.96,1])beam(at(t,0,.78),at(t,1,.78),.22,bamboo);
    for(const t of [0,.07,.93,1])beam(at(0,t,.78),at(1,t,.78),.25,bamboo);
    quad(at(.08,.12,.69),at(.92,.12,.69),at(.92,.88,.69),at(.08,.88,.69),[.22,.29,.15]);
    for(let i=0;i<72;i++) {
      const u=.10+(i%12)/13, v=.16+Math.floor(i/12)/8;
      const h=1.2+((i*17)%11)*.16, p=at(u,v,.72);
      beam(p,[p[0],h+1,p[2]],.055,[.30,.40,.13],5);
      for(let leaf=0;leaf<4;leaf++) {
        const angle=i*2.4+leaf*Math.PI/2, tip=[p[0]+Math.cos(angle)*1.1,h*.8+1,p[2]+Math.sin(angle)*1.1];
        const base=[p[0],.8,p[2]], mid=[(base[0]+tip[0])/2,h+1,(base[2]+tip[2])/2];
        mesh.tri(base,[mid[0]+.19,mid[1],mid[2]-.15],tip,[.24+(i%3)*.04,.40+(leaf%2)*.08,.12],12,id);
      }
      if(i%6===0)beam([p[0],h+.8,p[2]],[p[0],h+1.12,p[2]],.23,i%12?[.72,.66,.80]:[.88,.86,.72],6);
    }
    return;
  }
  if(feature.kind==="storage") {
    const concrete = [.65,.64,.57];
    const tankColor = [.12,.15,.18];
    // An open support frame makes the lower collection tank visible under the main tank.
    box(0,.1,0,14,.6,14,concrete);
    for (const x of [-6,6]) {
      for (const z of [-6,6]) box(x,.7,z,1.1,9.3,1.1,concrete);
    }
    beam(vertex(0,.7,0),vertex(0,8.2,0),4.6,tankColor,24);
    for (let i=0;i<5;i++) {
      beam(vertex(0,1.2+i*1.3,0),vertex(0,1.42+i*1.3,0),4.75,[.19,.22,.24],24);
    }
    beam(vertex(0,8.2,0),vertex(0,8.5,0),3.0,metal,24);
    box(0,10,0,15,.6,15,[.74,.73,.66]);
    beam(vertex(0,10.6,0),vertex(0,22,0),5.6,[.12,.15,.18],24);
    for(let i=0;i<7;i++)beam(vertex(0,11+i*1.5,0),vertex(0,11.2+i*1.5,0),5.75,[.19,.22,.24],24);
    beam(vertex(0,22,0),vertex(0,22.6,0),3.2,metal,24);
    box(5,13,-1,2.5,4,3,[.62,.68,.67]);
    // Dedicated overflow pipe runs from the upper rim into the covered lower tank.
    const overflow = [[5.4,21,-2],[8.2,21,-2],[8.2,8.8,-2],[2.8,8.8,-2],[2.8,8.2,-2]];
    for (let i=1;i<overflow.length;i++) {
      beam(vertex(...overflow[i-1]),vertex(...overflow[i]),.36,blue);
    }
    // A brass stand-off tap provides room beneath its downward spout for a vessel.
    const brass = [.67,.52,.22];
    beam(vertex(4.5,3.2,0),vertex(8.7,3.2,0),.27,blue);
    beam(vertex(8.7,3.2,0),vertex(9.5,3.2,0),.36,brass);
    beam(vertex(9.5,3.2,0),vertex(9.5,2.5,0),.26,brass);
    beam(vertex(8.8,3.2,0),vertex(8.8,4.1,0),.15,brass);
    beam(vertex(8.1,4.1,0),vertex(9.5,4.1,0),.17,[.72,.18,.12]);
    box(9.3,.1,0,4,.28,5,[.53,.55,.51]);
    for (const z of [-1.4,-.7,0,.7,1.4]) box(9.3,.39,z,2.8,.06,.12,metal);
    // Steps rise from the outer approach to the platform at the tank.
    for (let i=0;i<7;i++) {
      box(0,.1,14-i,5,(i+1)*1.5,1,[.61,.60,.53]);
    }
    for (const x of [-1.9,1.9]) {
      beam(vertex(x,3.2,14.5),vertex(x,12.2,7.5),.15,metal);
    }
  }
  if(feature.kind==="filter") {
    box(0,.3,0,18,2,14,[.65,.64,.56]);
    for(const x of [-8.4,8.4])box(x,2,0,1.2,7,14,[.73,.72,.64]);
    box(0,2,-6.4,18,7,1.2,[.73,.72,.64]);
    // Front inspection window reveals the media and percolating water.
    box(0,2,6.4,18,1.6,1.2,[.73,.72,.64]);
    box(0,8,6.4,18,1,1.2,[.73,.72,.64]);
    box(-4.2,2.4,0,6.8,3,11,[.34,.33,.28]);
    box(3.5,2.4,0,7,4.3,11,[.64,.58,.40]);
    box(0,2.4,0,.6,6,12,[.58,.59,.53]);
    for(let i=0;i<50;i++)box(-7+(i%10)*.6,5.5, -5+Math.floor(i/10)*2,.4,.2,.5,[.48,.48,.42]);
  }
  if(feature.kind==="pump") {
    box(0,1,0,15,1,15,[.42,.36,.25]);
    for(const x of [-6,6])for(const z of [-6,6])beam(vertex(x,.1,z),vertex(x,13,z),.32,bamboo);
    box(0,13,0,17,.4,17,[.14,.27,.45]);
    for(let i=-6;i<=6;i+=3)box(i,13.42,0,.09,.06,16,[.53,.61,.69]);
    for(let i=-6;i<=6;i+=4)box(0,13.42,i,16,.06,.09,[.53,.61,.69]);
    box(0,2,0,6,1,7,metal);
    beam(vertex(-2,4,0),vertex(2,4,0),1.7,[.07,.30,.43],16);
    beam(vertex(2,4,0),vertex(4,4,0),2.1,[.06,.25,.37],16);
    beam(vertex(4,4,0),vertex(4,7,0),.55,blue);
  }
}
