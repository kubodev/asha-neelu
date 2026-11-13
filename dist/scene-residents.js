import {fishPose} from "./aquaculture.js";
// Ten bind-pose transforms skin the anatomical mesh. Source joint pivots are
// in MakeHuman units; the root converts them to the map's local scale.
import {multiply} from "./scene-math.js";
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translate=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
function rotation(axis,angle){
  const m=identity(),a=(axis+1)%3,b=(axis+2)%3,c=Math.cos(angle),s=Math.sin(angle);
  m[a*4+a]=m[b*4+b]=c;m[a*4+b]=s;m[b*4+a]=-s;return m;
}
function joint(parent,x,y,z,pitch,roll=0){
  const local=multiply(rotation(0,pitch),rotation(2,roll));
  for(let i=0;i<3;i++)local[12+i]=[x,y,z][i]-local[i]*x-local[4+i]*y-local[8+i]*z;
  return multiply(parent,local);
}
function root(x,y,z,yaw,scale){
  const m=rotation(1,yaw);
  for(let i=0;i<12;i++)m[i]*=scale;
  m[12]=x;m[13]=y;m[14]=z;return m;
}
function skeleton(x,z,yaw,t,size,bend=0,walk=1){
  const swing=Math.sin(t)*walk;
  const base=root(x,.25+size*8.17+.07*Math.abs(swing)-.45*bend,z,yaw,size);
  const bones=[base,joint(base,0,.73,.15,.07+bend*.93)];
  for(const side of [1,-1]){
    const leg=joint(base,side*1.10,.49,.12,-side*swing*.52-bend*.72,-side*.12);
    bones.push(leg,joint(leg,side*1.58,-3.70,.32,Math.max(0,side*Math.cos(t))*.66*walk+bend*1.12));
  }
  for(const side of [1,-1]){
    const arm=joint(bones[1],side*1.68,5.25,.15,side*swing*.37-bend*.88,-side*.54);
    bones.push(arm,joint(arm,side*3.13,3.49,.13,.55-bend*.55,-side*.15));
  }
  return bones;
}
export function roadRoute(feature){
  const edges=[];let length=0;
  for(let i=1;i<(feature?.points.length||0);i++){
    const a=feature.points[i-1],b=feature.points[i],dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
    if(!d)continue;
    edges.push({a,x:dx/d,z:dz/d,start:length,end:length+d});length+=d;
  }
  if(!length)return null;
  return {length,at(distance,offset,reverse=false){
    const n=((distance%length)+length)%length,e=edges.find(s=>s.end>n)||edges.at(-1);
    return [e.a[0]+e.x*(n-e.start)-e.z*offset,e.a[1]+e.z*(n-e.start)+e.x*offset,
      Math.atan2(e.x,e.z)+(reverse?Math.PI:0)];
  }};
}
export function createVillageLife(gl,bind,u,redraw,onError){
  const models={},colors=[[.67,.79,.75],[.72,.42,.29],[.40,.56,.69],[.80,.66,.48],[.54,.36,.52]];
  let closed=false,roads=[],fishArea,tank,collection=0,lastTime=null,drawingWater=false;
  async function load(name){
    const response=await fetch(new URL('./assets/'+name+'.mesh',import.meta.url));
    if(!response.ok)throw Error(name+" model unavailable");
    const bytes=await response.arrayBuffer(),[vertices,count]=new Uint32Array(bytes,0,2);
    const indices=new Uint16Array(bytes,8+vertices*32,count);
    if(closed)return;
    const vertex=gl.createBuffer(),index=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(bytes,8,vertices*8),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    models[name]={vertex,index,count};redraw();
  }
  for(const name of ["resident","village-car","water-pot","pond-fish"])load(name).catch(e=>{if(!closed)onError?.(e.message);});
  function drawModel(name,bones,color){
    const m=models[name];if(!m)return;
    gl.uniformMatrix4fv(u.pose,false,new Float32Array(bones.flatMap(b=>Array.from(b))));
    gl.uniform3fv(u.fabric,color);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.vertex);
    bind("position",3,32,0);bind("color",3,32,12);bind("material",1,32,24);bind("feature",1,32,28);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.index);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);
  }
  return {
    update(items){
      roads=["R-001","R-005","R-006","R-007"].map(id=>roadRoute(items.find(f=>f.id===id)));
      fishArea=items.find(f=>f.kind==="fishery")?.points[0];
      const storage=items.find(f=>f.kind==="storage");
      tank=storage?.points.reduce((a,p)=>[a[0]+p[0]/storage.points.length,a[1]+p[1]/storage.points.length],[0,0]);
      collection=0;lastTime=null;
    },
    setCollection(active){drawingWater=active;},
    drawFish(time){
      gl.uniform1i(u.tree,0);
      if(fishArea){
        for(let i=0;i<13;i++){
          const [x,z,yaw]=fishPose(i,time);
          const body=root(fishArea[0]+x,.14+.012*Math.sin(time+i),fishArea[1]+z,yaw,.81+(i%4)*.09);
          body[5]*=.20;
          const tail=multiply(body,rotation(1,.26*Math.sin(5*time+i)));
          drawModel("pond-fish",[body,tail],colors[0]);
        }
      }
    },
    draw(time){
      gl.uniform1i(u.tree,0);
      const dt=lastTime===null?0:Math.max(0,Math.min(.5,time-lastTime));lastTime=time;
      collection=time===0?Number(drawingWater):Math.max(0,Math.min(1,collection+(drawingWater?1:-1)*dt*.85));
      roads.forEach((road,i)=>{
        if(!road)return;
        for(let j=0;j<2;j++){
          const dir=j?-1:1,speed=3.3+i*.22+j*.27;
          // Turn back at the end of the lane, keeping to the same shoulder.
          const cycle=2*road.length;
          const travel=((road.length*(j?.68:.42)+dir*time*speed)%cycle+cycle)%cycle;
          const returning=travel>=road.length;
          const along=returning?cycle-travel:travel;
          const [x,z,yaw]=road.at(Math.min(along,road.length-.001),dir*(i?3.7:11),returning!==(j===1));
          drawModel("resident",skeleton(x,z,yaw,time*speed*1.7+i+j,.31+.012*i),colors[(i+j)%colors.length]);
        }
      });
      if(roads[0])for(let j=0;j<2;j++){
        const dir=j?-1:1,r=roads[0];
        const [x,z,yaw]=r.at(r.length*(j?.77:.24)+dir*time*(j?18:16),-dir*5,j===1);
        drawModel("village-car",[root(x,.23,z,yaw,1)],j?[.84,.84,.78]:[.36,.49,.54]);
      }
      if(tank){
        const [x,z]=tank,f=collection*collection*(3-2*collection);
        drawModel("resident",skeleton(x+11.45,z+3.8*(1-f),-Math.PI/2,time*5,.32,f,0),colors[4]);
        drawModel("resident",skeleton(x+12.4,z-4.8,-.48,time,.31,0,0),colors[0]);
        drawModel("water-pot",[root(x+9.5,.46+.65*(1-f),z+3.8*(1-f),0,1)],colors[0]);
      }
    },
    destroy(){closed=true;for(const m of Object.values(models)){gl.deleteBuffer(m.vertex);gl.deleteBuffer(m.index);}}
  };
}
