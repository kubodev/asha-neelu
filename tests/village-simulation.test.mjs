import test from "node:test";
import assert from "node:assert/strict";
import {createIoTModel, capacities} from "../dist/iot-model.js";
import {applyEdits,empty} from "../dist/configuration.js";
import {createGuidedTour,tourShots} from "../dist/guided-tour.js";

test("solar loss stops powered equipment while gravity continues serving homes",()=>{
  const model=createIoTModel();
  model.scenario("low");
  for(const solar of [100,85,55,40,25,10,0]){
    const s=model.change("solar",solar);
    assert.ok(s.usedPower<=s.generation*.93+1e-8);
  }
  const dark=model.snapshot();
  assert.equal(dark.lamps,0);assert.equal(dark.aerating,false);assert.equal(dark.flow,0);
  assert.equal(model.step(1).main,dark.main-dark.homeFlow);
  const sun=model.scenario("sun");assert.ok(sun.flow && sun.lamps && sun.aerating);
});

test("surge, overflow, tap and household deliveries balance to the litre",()=>{
  const m=createIoTModel(),start=m.scenario("overflow");m.change("tap",true);
  let s;
  for(let i=0;i<24;i++)s=m.step();
  assert.ok(s.events.some(e=>e.type==="overflow"));
  assert.equal(s.main,capacities.main);
  assert.equal(s.main+s.lower+s.delivered+s.collected,start.main+start.lower+1800);
});

test("faults stop transfer and delivery until readings recover and an operator clears the alarm",()=>{
  for(const fault of ["cloudy","ph","chlorine","dry","sensor"]){
    const m=createIoTModel();m.scenario("low");
    if(fault==="sensor")m.change("sensor",false);else m.scenario(fault);
    const stopped=m.step();
    assert.equal(stopped.homeFlow,0);assert.equal(stopped.flow,0);
    assert.equal(m.scenario("ack").latched,true);
    assert.equal(m.scenario("recover").supplyOpen,false);
    assert.ok(m.scenario("ack").homeFlow>0);
  }
});

test("every road main has flow sections covering its entire physical route",()=>{
  const mains=applyEdits(empty(),2).filter(p=>p.id.startsWith("MAIN-"));
  const length=route=>route.slice(1).reduce((sum,b,i)=>sum+Math.hypot(...b.map((n,j)=>n-route[i][j])),0);
  for(const main of mains){
    const covered=main.flowSections.reduce((sum,s)=>{
      assert.ok(Number.isFinite(s.offset));return sum+length(s.route);
    },0);
    assert.ok(Math.abs(covered-length(main.route))<.02,main.id);
  }
});

test("presentation advances both stages, pauses, clears its scripted fault, finishes and replays",()=>{
  const elements=new Map();
  const el=id=>{
    if(!elements.has(id))elements.set(id,{querySelector:el,focus(){},classList:{add(){},remove(){},toggle(){}}});
    return elements.get(id);
  };
  globalThis.document={getElementById:el,body:el("body"),addEventListener(){},hidden:false};
  globalThis.matchMedia=()=>({matches:false});
  globalThis.innerWidth=1280;globalThis.innerHeight=800;
  let next,time=1,pose={target:[0,0,0],yaw:0,pitch:1,distance:900},frozen=false,stage=1;
  globalThis.requestAnimationFrame=cb=>{next=cb;return 1;};
  globalThis.cancelAnimationFrame=()=>{next=null;};
  const model=createIoTModel(),visited=[],seen=new Set();
  const system={...model,setGuided(){},advance(dt){model.step(dt);}};
  const scene={getCamera:()=>pose,pauseAnimation(v){frozen=v;},setCamera(p){
    assert.ok([p.yaw,p.pitch,p.distance,...p.target].every(Number.isFinite));pose=p;
  }};
  const guide=createGuidedTour({scene,system,stage:v=>{stage=v;visited.push(v);},prepare(){}});
  const advance=()=>{
    time+=100;
    next(time);seen.add(el("h2").textContent);
  };
  const click=action=>el("guide").onclick({target:{closest:()=>({dataset:{guide:action}})}});
  el("start-guide").onclick();advance();click("pause");
  const still=pose;
  for(let i=0;i<120;i++)advance();
  assert.equal(pose,still);assert.equal(frozen,true);click("pause");
  for(const shot of tourShots){
    for(let i=0;i<220;i++)advance();
    assert.equal(el("h2").textContent,shot.title);
    assert.ok(guide.active);
    if(shot.action==="recover")assert.equal(model.snapshot().supplyOpen,false);
    click("next");
  }
  assert.equal(guide.active,false);assert.equal(el("start-guide").textContent,"Replay guided tour");
  assert.equal(seen.size,tourShots.length);assert.ok(visited.includes(1)&&visited.includes(2));
  assert.equal(model.snapshot().latched,false);
  assert.ok(model.snapshot().events.some(e=>e.type==="acknowledgement"));
  el("start-guide").onclick();assert.equal(stage,1);click("next");click("prev");click("exit");
  assert.equal(guide.active,false);
});

test("energy integrates kilowatts over simulated minutes and overflow counts only excess water",()=>{
  const model=createIoTModel(),start=model.snapshot();
  model.step(1);
  assert.equal(model.snapshot().solarKwh,start.generation/60);
  const dark=model.scenario("shade");
  model.step(1);
  assert.equal(model.snapshot().solarKwh,dark.solarKwh);
  model.scenario("overflow");
  const s=model.step(1);
  assert.equal(s.overflowLitres,40);
  assert.equal(model.reset().overflowLitres,0);
});
