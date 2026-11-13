// Target x/y/z, camera heading, elevation and distance in local map units.
const shots=[
  [1,"Malkapuram today","The reservoir sits beside the main road. The surrounding lanes show the homes that depend on village services.",[30,0,10,-.35,.85,1100]],
  [1,"At the water’s edge","Algae and muddy banks illustrate the current condition. This shoreline is the starting point for the proposal.",[206,1,-39,-.42,.58,320]],
  [2,"The proposed reservoir","The same shoreline now holds floating solar panels, planted bamboo rafts and paddlewheel aerators. Climbers line the roadside fence.",[206,1,-39,-.42,.58,320]],
  [2,"Water from the north","The dashed blueprint traces the proposed buried supply from the Krishna River to the reservoir.",[120,0,-3000,0,1.47,9300],"low"],
  [2,"From sunlight to electricity","Floating panels feed the shore-side DC combiner. The inverter converts DC to AC, and one distribution box feeds the village circuits.",[126,3,-107,-.35,.75,213]],
  [2,"When solar power drops","Watch the streetlights and aerators stop. Stored water can still reach homes by gravity.",[77,10,-111,-.83,.38,87],"shade"],
  [2,"Power returns","Sunlight restores the electrical supply. Follow the gold pulses from the distribution box to the lamps.",[77,10,-111,-.83,.38,87],"sun"],
  [2,"Rafts and aerators","Plants grow on bamboo frames while seven powered paddlewheels circulate pond water.",[245,2,6,-.61,.54,120]],
  [2,"Through the filter","The intake pump sends pond water to the filter. Watch the inlet stream, gravel and sand beds, then the blue outlet to storage.",[335,5,-16,-.48,.49,48],"low"],
  [2,"Overflow and collection","A simulated inlet surge fills the upper tank. Overflow drains into the lower tank. At the public tap, a resident places a water pot beneath the stream.",[332,7,17,-.24,.29,51],"overflow"],
  [2,"From storage to homes","The tank feeds the road mains and short service branches. Connections stay on the reservoir side of the main road.",[172,2,138,-.32,.89,340],"low"],
  [2,"How does the tank know when to fill?","The sensor above the upper tank uses sound to measure the water level. At 35% or below, the controller starts the pump. At 90%, it stops filling.",[327,16,16,-.85,.36,50],"low"],
  [2,"How does the village spot a problem?","The flow meter checks whether water is moving. The turbidity sensor measures cloudiness. Near storage, separate probes check pH and the chlorine remaining in the water.",[338,6,-19,-.65,.52,65]],
  [2,"Cloudy water triggers an alert","Watch the turbidity reading jump to 6 NTU, above the demo limit of 1 NTU. The controller stops the pump, closes the outlet to homes and records the alarm in the event log.",[337,7,-18,-.76,.41,75],"cloudy"],
  [2,"The reading recovers. Supply stays closed.","The simulated filter check restores the cloudiness reading. The controller keeps the valve closed until an operator checks the equipment and clears the alert. Click Next to demonstrate that acknowledgement.",[333,10,17,-.85,.36,68],"recover"],
  [2,"The operator clears the alert","The controller records the acknowledgement and opens the outlet valve. The household flow reading shows water leaving storage again.",[341,12,16,-1,.36,55],"ack"],
  [2,"The village in operation","Water, power and monitoring now work together. Open Village systems to inspect readings or try either fault again.",[52,0,17,-.37,.84,870]],
  [3,"Fish farming for village income","Residents could raise fish in the pond and sell the harvest locally. After paying for young fish, feed and upkeep, the group could share the profit.",[158,0,-3,-.44,.91,42]]
];
const stops=shots.map(([stage,title,caption,pose,action])=>({stage,title,caption,pose,action}));
export const tourShots=stops;
export function blendCamera(a,b,t){
  const mix=(v,w)=>v+(w-v)*t;
  const arc=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
  const travel=Math.hypot(b.target[0]-a.target[0],b.target[2]-a.target[2]);
  return {mode:"orbit",target:a.target.map((v,i)=>mix(v,b.target[i])),yaw:a.yaw+arc*t,
    pitch:mix(a.pitch,b.pitch),distance:Math.exp(mix(Math.log(a.distance),Math.log(b.distance)))+travel*.55*Math.sin(Math.PI*t)};
}
export function createGuidedTour({scene,system,stage,prepare}) {
  const card=document.getElementById("guide"),start=document.getElementById("start-guide");
  const field=s=>card.querySelector(s);
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let index=-1,clock=0,paused=false,frame=0,last=0,arrived=false,from,goal;
  const arrival=3.6;
  function stop(done=false){
    if(index<0)return;
    cancelAnimationFrame(frame);index=-1;system.setGuided(false);scene.pauseAnimation(false);card.hidden=true;
    document.body.classList.remove("guiding");
    start.textContent=done?"Replay guided tour":"Start guided tour";
    start.focus({preventScroll:true});
  }
  function enter(i,seek=false){
    if(i>=shots.length){stop(true);return;}
    index=Math.max(0,i);clock=paused?arrival:0;last=0;arrived=false;
    const {stage:number,title,caption,pose,action}=stops[index];
    stage(number);from=scene.getCamera();
    const [x,y,z,yaw,pitch,distance]=pose;
    const aspect=innerWidth/innerHeight;
    goal={mode:"orbit",target:[x,y,z],yaw,pitch,distance:distance/Math.min(1,Math.max(.52,aspect))};
    // Each scenario starts from a known state when revisiting a stop.
    if(number===2){
      if(seek){system.reset();system.scenario("low");}
      if(action==="ack" && seek){system.scenario("cloudy");system.scenario("recover");}
      if(action==="recover" && seek)system.scenario("cloudy");
      if(action)system.scenario(action);
      if(action==="overflow")system.change("tap",true);
    }
    field("small").textContent=`STAGE ${number}  /  STOP ${index+1} OF ${shots.length}`;
    field("h2").textContent=title;field(".caption").textContent=caption;
    field('[data-guide="prev"]').disabled=index===0;
    field('[data-guide="next"]').textContent=index===shots.length-1?"Finish":"Next";
    field("progress").value=(index+1)/shots.length;
    draw();
  }
  function draw(){
    if(index<0)return;
    const t=Math.min(clock/arrival,1),e=t*t*(3-2*t);
    if(clock<=arrival || !arrived){
      scene.setCamera(reduced.matches || t===1?goal:blendCamera(from,goal,e));
      arrived=reduced.matches || t===1;
    }
    const s=system.snapshot();
    const readings=[
      "Current conditions","Current conditions","Proposed improvements",
      `River intake · ${s.riverFlow} L/min`,
      `Array output · ${s.generation.toFixed(1)} kW DC`,
      `${s.lamps} lights on · ${s.homeFlow} L/min to homes`,
      `${s.lamps} lights on · ${s.generation.toFixed(1)} kW solar`,
      s.aerating?"7 paddlewheels running":"Paddlewheels stopped",
      `Filter inlet · ${s.flow} L/min · Turbidity ${s.turbidity} NTU`,
      `Upper tank ${Math.round(s.main)} L · Collection tank ${Math.round(s.lower)} L · Tap ${s.tapFlow} L/min`,
      `Household supply · ${s.homeFlow} L/min`,
      `Upper tank ${Math.round(s.main/100)}% · Pump ${s.pump?"running":"stopped"}`,
      `Inlet ${s.flow} L/min · pH ${s.ph} · Free chlorine ${s.chlorine} mg/L`,
      `Turbidity ${s.turbidity} NTU · Valve ${s.supplyOpen?"open":"closed"} · ${s.homeFlow} L/min to homes`,
      `Turbidity ${s.turbidity} NTU · Waiting for operator · ${s.homeFlow} L/min to homes`,
      `Alert cleared · Valve open · ${s.homeFlow} L/min to homes`,
      `${s.generation.toFixed(1)} kW solar · ${s.lamps} lights on · ${s.homeFlow} L/min to homes`,
      "Proposed community fishery"
    ];
    const meter=field(".telemetry");
    if(meter.textContent!==readings[index])meter.textContent=readings[index];
    field(".telemetry").classList.toggle("alert",!!s.latched && stops[index].stage>=2);
  }
  function tick(now){
    if(index<0)return;
    if(last && !paused && !document.hidden){
      const elapsed=Math.min(.2,(now-last)/1000);
      clock+=elapsed;
      if(stops[index].stage>=2)system.advance(elapsed);
    }
    last=now;
    if(!paused&&!document.hidden)draw();
    if(index>=0)frame=requestAnimationFrame(tick);
  }
  function pause(v){
    paused=v;scene.pauseAnimation(v);field('[data-guide="pause"]').textContent=v?"Resume":"Pause";
  }
  start.onclick=()=>{
    if(index>=0)return;
    prepare();system.setGuided(true);system.reset();document.body.classList.add("guiding");card.hidden=false;
    pause(false);enter(0);field('[data-guide="next"]').focus({preventScroll:true});frame=requestAnimationFrame(tick);
  };
  card.onclick=e=>{
    switch(e.target.closest("button")?.dataset.guide){
      case "prev":enter(index-1,true);break;
      case "next":enter(index+1);break;
      case "pause":pause(!paused);break;
      case "exit":stop();break;
    }
  };
  document.addEventListener("keydown",e=>{if(index>=0 && e.key==="Escape")stop();});
  return {stop, get active(){return index>=0;}};
}
