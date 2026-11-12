import { createIoTModel, capacities } from "./iot-model.js";
export function createTankIoT(parent,onUpdate,onLocate=()=>{}) {
  const panel=document.createElement("section");
  panel.className="iot-panel";panel.hidden=true;panel.setAttribute("aria-label","Water IoT simulation");
  panel.innerHTML=`
    <header class="iot-heading"><div><strong>Water IoT control</strong><small>Simulated readings · 1 second = 1 minute</small></div><button data-iot="close" aria-label="Close IoT panel">×</button></header>
    <div class="iot-content">
      <div class="iot-status" role="status" data-read="status"></div>
      <section class="iot-advisor"><strong>System advisor <small>Local rules</small></strong><p data-read="advice"></p></section>
      <div class="iot-level"><label>Main storage <b data-read="main"></b></label><progress max="100" data-read="main-bar"></progress><small>Ultrasonic sensor · 10,000 L demo capacity</small></div>
      <div class="iot-level"><label>Lower collection tank <b data-read="lower"></b></label><progress max="100" data-read="lower-bar"></progress><small>Level switch · 3,000 L demo capacity</small></div>
      <dl class="iot-metrics">
        <div><dt>Turbidity · pre-disinfection</dt><dd data-read="turbidity"></dd></div>
        <div><dt>Inlet flow</dt><dd data-read="flow"></dd></div>
        <div><dt>pH · treatment outlet</dt><dd data-read="ph"></dd></div>
        <div><dt>Free chlorine · storage</dt><dd data-read="chlorine"></dd></div>
        <div><dt>Pump protection</dt><dd data-read="protection"></dd></div>
        <div><dt>Supply valve</dt><dd data-read="valve"></dd></div>
        <div><dt>Aerators</dt><dd data-read="aerators"></dd></div>
        <div><dt>Solar supply</dt><dd data-read="solar"></dd></div>
      </dl>
      <div class="iot-buttons"><button data-iot="ack">Acknowledge alert</button><button data-iot="run">Pause</button><button data-iot="reset">Reset</button></div>
      <details><summary>Try automation scenarios</summary><div class="iot-buttons">
        <button data-iot="low">Low tank</button><button data-iot="overflow">Overflow surge</button>
        <button data-iot="cloudy">Cloudy water</button><button data-iot="ph">Abnormal pH</button>
        <button data-iot="chlorine">Low chlorine</button><button data-iot="dry">Pump dry run</button>
        <button data-iot="sensor">Toggle level sensor</button><button data-iot="recover">Restore readings</button>
      </div></details>
      <details><summary>Pump, solar and tap controls</summary>
        <label class="iot-control">Control mode<select data-control="mode"><option value="auto">Auto · start 35%, stop 90%</option><option value="manual">Manual</option></select></label>
        <div class="iot-buttons"><button data-iot="pump">Manual pump ON/OFF</button><button data-iot="aerators">Toggle aerators</button></div>
        <label class="iot-control">Village demand <output data-read="demand"></output><input data-control="demand" type="range" min="0" max="350" step="10" value="160"></label>
        <label class="iot-control">Available solar <input data-control="solar" type="range" min="0" max="100" step="5" value="85"></label>
        <label class="iot-check"><input type="checkbox" data-control="tap"> Open public tap on lower tank</label>
      </details>
      <details><summary>Locate physical equipment</summary><div class="iot-buttons">
        <button data-locate="IOT-TURBIDITY">Turbidity sensor</button><button data-locate="IOT-FLOW">Flow meter</button>
        <button data-locate="IOT-PH">pH probe</button><button data-locate="IOT-CHLORINE">Chlorine analyser</button>
        <button data-locate="IOT-MAIN">Tank sensors</button><button data-locate="IOT-PROTECT">Pump protection</button>
        <button data-locate="IOT-CONTROL">ESP32 controller</button><button data-locate="AERATOR-1">Aerators</button>
      </div></details>
      <p class="iot-rule">Demo alarm limits: turbidity above 1 NTU, pH outside 6.5–8.5, chlorine outside 0.2–1 mg/L. Faults hold transfer and supply until readings recover and an operator clears the alert. Site commissioning determines real operating limits.</p>
      <strong class="iot-log-label">Operator alerts & event log</strong><ol class="iot-events" data-read="events"></ol>
    </div>`;
  parent.append(panel);
  const model=createIoTModel();let active=false;
  const read=name=>panel.querySelector(`[data-read="${name}"]`);
  const control=name=>panel.querySelector(`[data-control="${name}"]`);
  function render(state=model.snapshot()) {
    const main=state.main/capacities.main,lower=state.lower/capacities.lower;
    read("status").textContent=state.status;
    read("status").classList.toggle("iot-alert",state.latched||state.solar<15||lower>=.95);
    read("advice").textContent=state.advice;
    read("main").textContent=`${(main*100).toFixed(1)}%`;read("main-bar").value=main*100;
    read("lower").textContent=`${(lower*100).toFixed(1)}%`;read("lower-bar").value=lower*100;
    read("turbidity").textContent=`${state.turbidity.toFixed(2)} NTU`;
    read("flow").textContent=`${state.flow} L/min`;
    read("ph").textContent=state.ph.toFixed(1);
    read("chlorine").textContent=`${state.chlorine.toFixed(2)} mg/L`;
    read("protection").textContent=state.dryRun?"Dry-run trip":!state.sensor?"Sensor offline":"Ready";
    read("valve").textContent=state.supplyOpen?"Open":"Held closed";
    read("aerators").textContent=state.aerators&&state.solar>=15?"Running":"Stopped";
    read("solar").textContent=`${state.solar}% available`;
    read("demand").textContent=`${state.demand} L/min`;
    control("mode").value=state.mode;
    panel.querySelector('[data-iot="pump"]').disabled=state.mode!=="manual";
    panel.querySelector('[data-iot="run"]').textContent=state.running?"Pause":"Resume";
    read("events").replaceChildren(...state.events.slice(-12).reverse().map(event=>{
      const li=document.createElement("li");li.textContent=`${event.simulationMinute} min · ${event.message}`;
      li.dataset.severity=event.severity;return li;
    }));
    onUpdate([main,lower,state.pump?1:0,state.latched?1:0],[state.aerators&&state.solar>=15?1:0,state.supplyOpen?1:0]);
  }
  panel.addEventListener("click",event=>{
    const locate=event.target.closest("[data-locate]")?.dataset.locate;
    if(locate){onLocate(locate);return;}
    const action=event.target.closest("[data-iot]")?.dataset.iot;
    if(!action)return;
    if(action==="close"){panel.hidden=true;return;}
    let state=model.snapshot();
    if(action==="reset") {
      state=model.reset();control("solar").value=85;control("demand").value=160;control("tap").checked=false;
    } else if(action==="run")state=model.change("running",!state.running);
    else if(action==="pump"&&state.mode==="manual")state=model.change("pump",!state.pump);
    else if(action==="sensor")state=model.change("sensor",!state.sensor);
    else if(action==="aerators")state=model.change("aerators",!state.aerators);
    else state=model.scenario(action);
    render(state);
  });
  panel.addEventListener("input",event=>{
    const name=event.target.dataset.control;
    if(!name)return;
    const value=name==="tap"?event.target.checked:name==="mode"?event.target.value:Number(event.target.value);
    render(model.change(name,value));
  });
  const timer=setInterval(()=>{if(active)render(model.step());},250);
  render();
  return {open(){active=true;panel.hidden=false;render();},setActive(value){active=value;if(!value)panel.hidden=true;},
    snapshot:model.snapshot,destroy(){clearInterval(timer);panel.remove();}};
}
