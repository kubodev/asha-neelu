import { capacities, createIoTModel } from "./iot-model.js";
import { electricityFeatures } from "./scene-electricity.js";

import { createPhoneSync } from "./phone-sync.js";

export function createTankIoT(parent,onUpdate,report) {
  const count=electricityFeatures.filter(f=>f.kind==="powerPole").length;
  const model=createIoTModel(undefined,count);
  const publish=createPhoneSync(report);
  let scheduled=false;
  const panel=document.createElement("section");
  panel.className="system-sheet";panel.hidden=true;panel.setAttribute("aria-label","Village systems");
  panel.innerHTML=`<header><div><small>STAGE 2 · SIMULATION</small><h2>Village systems</h2></div><button data-op="close" aria-label="Close village systems">×</button></header>
    <p class="system-message" role="status"></p>
    <div class="system-readings"><div>Tank storage<strong data-val="storage"></strong><progress max="100"></progress></div>
    <div>Water to homes<strong data-val="homes"></strong></div><div>Solar output<strong data-val="solar"></strong></div>
    <div>Streetlights<strong data-val="lights"></strong></div></div>
    <div class="system-actions"><button data-op="alarm"></button><button data-op="power"></button></div>
    <details><summary>Sensor readings &amp; event log</summary><p data-val="readings"></p><ol></ol></details>
    <details><summary>Try another device</summary><div class="system-actions">
    <button data-test="low">Low tank</button><button data-test="overflow">Tank overflow</button>
    <button data-test="tap">Public tap</button><button data-test="ph">pH alarm</button>
    <button data-test="chlorine">Low chlorine</button><button data-test="dry">Dry intake</button>
    <button data-test="sensor">Level sensor offline</button><button data-test="reset">Reset demo</button></div></details>`;
  parent.append(panel);
  let active=false,guided=false,lastEvent="";
  const value=(name,text)=>{panel.querySelector(`[data-val="${name}"]`).textContent=text;};
  function render(s=model.snapshot()) {
    if(active && !scheduled){
      scheduled=true;
      queueMicrotask(()=>{scheduled=false;if(active)publish(model.snapshot());});
    }
    const upper=s.main/capacities.main,lower=s.lower/capacities.lower;
    onUpdate([upper,lower,Number(s.pump),Number(s.latched)],[Number(s.aerating),Number(s.supplyOpen)],
      [Number(s.generation>0),Math.min(1,s.homeFlow/160),Number(!!s.overflowing),s.lightLevel],Number(s.tapFlow>0),Number(s.riverFlow>0));
    const shortcut=document.getElementById("systems-button");
    shortcut.classList.toggle("system-alert",active && s.latched);
    shortcut.textContent=s.latched?"Village systems · Alert":"Village systems";
    if(panel.hidden)return;
    const message=s.latched?(s.problems.length?s.problems[0]+" Supply held.":"Readings restored. Clear the alert to reopen supply."):s.status;
    const status=panel.querySelector(".system-message");
    if(status.textContent!==message)status.textContent=message;
    status.classList.toggle("alarm",s.latched);
    value("storage",Math.round(upper*100)+"%");panel.querySelector("progress").value=upper*100;
    value("homes",s.homeFlow+" L/min");value("solar",s.generation.toFixed(1)+" kW");
    value("lights",s.lamps?s.lamps+" on":"Off");
    value("readings",`Inlet ${s.flow} L/min · Turbidity ${s.turbidity} NTU · pH ${s.ph} · Free chlorine ${s.chlorine} mg/L · Lower tank ${Math.round(s.lower)} L · Public tap ${s.tapFlow} L/min`);
    panel.querySelector('[data-op="alarm"]').textContent=!s.latched?"Test cloudy water":s.problems.length?"Restore readings":"Clear alert";
    panel.querySelector('[data-op="power"]').textContent=s.solar?"Test solar outage":"Restore sunshine";
    if(lastEvent!==s.events.at(-1)?.id){
      lastEvent=s.events.at(-1)?.id;
      panel.querySelector("ol").replaceChildren(...s.events.slice(-6).reverse().map(e=>{
        const li=document.createElement("li");li.textContent=`${e.simulationMinute.toFixed(1)} min · ${e.message}`;return li;
      }));
    }
  }
  panel.onclick=e=>{
    const op=e.target.closest("button")?.dataset.op,s=model.snapshot();
    const test=e.target.closest("button")?.dataset.test;
    if(test==="reset")render(model.reset());
    else if(test==="tap")render(model.change("tap",!s.tap));
    else if(test==="sensor")render(model.change("sensor",false));
    else if(test==="overflow"){model.change("tap",true);render(model.scenario(test));}
    else if(test)render(model.scenario(test));
    if(op==="close")panel.hidden=true;
    if(op==="alarm")render(model.scenario(!s.latched?"cloudy":s.problems.length?"recover":"ack"));
    if(op==="power")render(model.scenario(s.solar?"shade":"sun"));
  };
  const timer=setInterval(()=>{if(active&&!guided&&!document.hidden)render(model.step());},250);
  return {open(){panel.hidden=false;render();},close(){panel.hidden=true;},
    setActive(v){active=v;if(!v)panel.hidden=true;render();},setGuided(v){guided=v;},advance(dt){if(active)render(model.step(dt));},
    reset(){render(model.reset());},scenario(name){render(model.scenario(name));},change(k,v){render(model.change(k,v));},
    snapshot:model.snapshot,destroy(){clearInterval(timer);panel.remove();}};
}
