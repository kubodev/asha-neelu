import { writeNameplate } from "./scene-labels.js";
const device = (id,name,x,z,height,deviceType,labelIndex) => ({
  id,name,kind:"iotDevice",points:[[x,z]],height,deviceType,labelIndex,
  source:"Stage 2 IoT simulation concept",confidence:"Illustrative proposal",
});
export const iotDevices = [
  device("IOT-MAIN","Ultrasonic tank level sensor",327,16,22.8,"main",9),
  device("IOT-LOWER","Overflow tank level switch",327,16,8.6,"lower",10),
  device("IOT-CONTROL","ESP32 controller and pump relay",333,21,6,"controller",3),
  device("IOT-FLOW","Inlet flow meter",337,-24,5,"flow",5),
  device("IOT-TURBIDITY","Turbidity sensor · before disinfection",337,-14,5,"turbidity",4),
  device("IOT-PH","pH probe · treatment outlet",345,-10,6,"ph",6),
  device("IOT-CHLORINE","Free-chlorine analyser · storage sample loop",340,18,6,"chlorine",7),
  device("IOT-PROTECT","Pump protection · flow and dry-run relay",331,-43,6,"protection",8),
  device("IOT-VALVE","Motorised storage outlet valve",341,16,12,"valve",12),
  ...[[137,-107],[225,-75],[289,-67],[236,74],[146,5],[311,20],[245,5]].map(([x,z],index)=>device(
    `AERATOR-${index+1}`,"Solar-powered paddlewheel aerator",x,z,2,"aerator",11)),
];

export const iotPowerCables = iotDevices.filter(d=>d.deviceType==="aerator").map((d,i)=>({
  id:`AERATOR-FEED-${i+1}`,name:"Solar AC supply to aerator",kind:"powerCable",
  points:[[69.5,-118],d.points[0]],
  route:[[69.5,3,-118],[80,3,-118],[90,.7,-140],[d.points[0][0],.7,d.points[0][1]]],
  color:[.18,.21,.22],source:"Stage 2 solar aeration proposal",confidence:"Illustrative proposal",
}));

export function renderIoT(mesh,feature,id) {
  const [x,z]=feature.points[0], y=feature.height;
  function box(cx,cy,cz,w,h,d,color,material=12) {
    const ring=[[cx-w/2,cy,cz-d/2],[cx+w/2,cy,cz-d/2],[cx+w/2,cy,cz+d/2],[cx-w/2,cy,cz+d/2]];
    const top=ring.map(p=>[p[0],p[1]+h,p[2]]);
    mesh.quad(...top,color,material,id);
    for(let i=0;i<4;i++)mesh.quad(ring[i],ring[(i+1)%4],top[(i+1)%4],top[i],color,material,id);
  }
  const silver=[.69,.74,.76], turquoise=[.08,.54,.59];
  if(feature.deviceType==="aerator") {
    for(const dz of [-2.8,2.8])box(x,.36,z+dz,9,.85,1.3,[.10,.40,.52]);
    for(const dx of [-3.8,3.8])box(x+dx,1.1,z,.4,.45,6,silver);
    box(x,1.8,z,9,.35,.35,silver);
    box(x-3,1.5,z,2,1.3,1.6,turquoise);
    // Rotor vertices carry their pivot in colour; the vertex shader rotates them.
    for(const dx of [-1.8,1.8])for(let blade=0;blade<8;blade++) {
      const angle=blade*Math.PI/4;
      const inner=.5,outer=1.9;
      const at=(offset,radius)=>[x+dx+offset,2+Math.cos(angle)*radius,z+Math.sin(angle)*radius];
      mesh.quad(at(-.9,inner),at(.9,inner),at(.9,outer),at(-.9,outer),[x,2,z],30,id);
    }
    return;
  }
  box(x,y,z,2.1,.8,1.8,silver);
  box(x,y+.8,z,1.5,.25,1.2,turquoise);
  if(feature.deviceType==="main" || feature.deviceType==="lower") {
    box(x,y-.6,z,.65,.6,.65,[.21,.25,.27]);
    box(x+1.8,y,z,.12,1.3,.12,[.24,.28,.30]);
    box((x+332)/2,y+.9,z,332-x,.12,.12,[.21,.25,.26]);
    const main=feature.deviceType==="main";
    const bottom=main?10.7:.7, top=main?22:8.2;
    // External level gauges make the live simulated fill readable on opaque tanks.
    box(333.0,bottom,17.6,.45,top-bottom,.4,[.12,.19,.22]);
    box(333.3,bottom,17.6,.16,top-bottom,.42,[.1,.65,.82],main?25:26);
    for(let i=0;i<=5;i++)box(333.5,bottom+(top-bottom)*i/5,17.6,.4,.06,.5,silver);
  }
  if(feature.deviceType==="controller") {
    box(x,y-2,z,2.5,3.2,1.2,silver);
    box(x,y-.5,z+.66,1.5,.75,.15,[.07,.20,.24]);
    box(x+.65,y+.45,z+.68,.25,.25,.15,[.2,.9,.4],27);
    box(x,y+1.2,z,.12,2.2,.12,[.16,.20,.22]);
    box(x-1,y-1.8,z,.12,18.3,.12,[.21,.25,.26]);
    box(x-1,y-1.8,z,.12,.12,4.3,[.21,.25,.26]);
    box(333,3,-11.5,.12,.12,65,[.21,.25,.26]);
    box(328.5,3,-44,9,.12,.12,[.21,.25,.26]);

  }
  if(feature.deviceType==="flow") {
    box(x,y-.65,z,2,1.6,2,turquoise);
    box(x,y+.95,z,.9,.7,.9,[.12,.21,.23]);
  }

  if (["turbidity","ph","chlorine","protection"].includes(feature.deviceType)) {
    box(x,.2,z,.3,y,.3,silver);
    box(x,y-.6,z,2.5,2.4,1.6,silver);
    box(x,y+.3,z+.86,1.5,.6,.1,[.08,.22,.26]);
    box(x+.9,y+1,z+.88,.22,.22,.12,[.1,.8,.4],27);
    box(x,y-1.8,z,.18,1.3,.18,turquoise);
    if(feature.deviceType==="ph" || feature.deviceType==="chlorine") {
      const source=feature.deviceType==="ph"?[337,5,-14]:[333,14,16];
      const middle=(source[0]+x)/2;
      box(middle,source[1],source[2],Math.abs(x-source[0]),.18,.18,turquoise);
      box(x,source[1],(source[2]+z)/2,.18,.18,Math.abs(source[2]-z),turquoise);
      box(x,Math.min(source[1],y-1.8),z,.18,Math.abs(source[1]-(y-1.8)),.18,turquoise);
    }
  }
  if(feature.deviceType==="valve") {
    box(x,y-1,z,1.4,2,1.4,turquoise);
    box(x,y+1,z,2.1,.8,1.8,[.1,.65,.3],28);
  }
  writeNameplate(mesh,id,{
    x,z:z+1,bottom:feature.deviceType==="controller"?y-1.6:y+1.4,
    width:5,height:1.35,row:feature.labelIndex,
  });
}
