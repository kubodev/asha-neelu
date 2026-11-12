// Demonstration limits and capacities, to be replaced by commissioned site settings.
export const demoLimits = { turbidity: 1, phMin: 6.5, phMax: 8.5, chlorineMin: .2, chlorineMax: 1 };
export const capacities = { main:10000, lower:3000 };
export function createIoTModel(onEvent=()=>{}) {
  let state,events,elapsed,surge,previous="",sequence=0;
  const emit=(type,message,severity="info")=>{
    const event={id:`${state.session}-${++sequence}`,timestamp:new Date().toISOString(),
      simulationMinute:Number(elapsed.toFixed(2)),type,severity,message};
    events.push(event);if(events.length>200)events.shift();onEvent(event);
  };
  function issues() {
    const problems=[];
    if(!state.sensor)problems.push("The main level sensor is offline. Check its cable and power.");
    if(state.dryRun)problems.push("The pump has lost inlet flow. Check the intake and prime the pump.");
    if(state.turbidity>demoLimits.turbidity)problems.push("Water is too cloudy at the pre-disinfection sensor. Inspect the filter.");
    if(state.ph<demoLimits.phMin||state.ph>demoLimits.phMax)problems.push("The pH reading is outside the demo range. Check the probe and treatment process.");
    if(state.chlorine<demoLimits.chlorineMin)problems.push("Free chlorine is low at storage. An operator should check disinfection and retest.");
    if(state.chlorine>demoLimits.chlorineMax)problems.push("Free chlorine is above the demo limit. An operator should check dosing and retest.");
    return problems;
  }
  function control() {
    const problems=issues();
    if(problems.length && !state.latched) {
      state.latched=true;
      emit("alarm",problems.join(" "),"critical");
    }
    let status;
    if(state.latched){state.pump=false;status="Supply held · operator attention";}
    else if(state.solar<15){state.pump=false;status="Low solar · pump stopped";}
    else if(state.lower>=capacities.lower*.95){state.pump=false;status="Lower tank high · pump stopped";}
    else {
      if(state.mode==="auto") {
        if(state.main<=capacities.main*.35)state.pump=true;
        if(state.main>=capacities.main*.90)state.pump=false;
      }
      status=state.pump?"Pump ON · filling storage":"Pump OFF · supplying homes";
    }
    state.supplyOpen=!state.latched;
    state.status=status;
    state.problems=problems;
    if(status!==previous){emit("controller",status,state.latched?"critical":"info");previous=status;}
    state.advice=problems[0] || (state.latched
      ? "Readings have recovered. Inspect the equipment, then acknowledge the alert to resume supply."
      : state.solar<15 ? "Solar power is low. The pump is waiting. Stored water can continue to supply homes."
      : state.lower>=capacities.lower*.95 ? "The lower tank is almost full. The inlet pump is stopped. Check collection capacity."
      : state.pump ? "Storage is low. The controller is filling it and will stop the pump at 90%."
      : "The inlet pump is resting. Stored water is available, and auto mode restarts filling below 35%.");
    state.flow=state.pump&&!state.dryRun?600:0;
    return snapshot();
  }
  function snapshot(){return {...state,events:[...events],elapsed};}
  function reset(){
    state={session:Date.now(),main:4200,lower:360,mode:"auto",pump:false,solar:85,demand:160,tap:false,
      sensor:true,running:true,turbidity:.45,ph:7.2,chlorine:.45,dryRun:false,aerators:true,latched:false};
    events=[];elapsed=0;surge=0;previous="";sequence=0;emit("startup","Demo controller connected to level, flow, turbidity, pH and chlorine sensors.");
    return control();
  }
  function change(name,value){
    if(!["mode","pump","solar","demand","tap","sensor","running","aerators"].includes(name))return snapshot();
    state[name]=value;
    emit("operator",`${name} changed to ${value}.`);
    return control();
  }
  function scenario(name){
    if(name==="low"){state.main=2500;state.mode="auto";}
    if(name==="overflow"){state.main=9900;surge=1800;}
    if(name==="cloudy")state.turbidity=6;
    if(name==="ph")state.ph=9.1;
    if(name==="chlorine")state.chlorine=.05;
    if(name==="dry")state.dryRun=true;
    if(name==="recover"){
      state.turbidity=.45;state.ph=7.2;state.chlorine=.45;state.dryRun=false;state.sensor=true;
    }
    if(name==="ack") {
      if(issues().length){emit("acknowledgement","Alert acknowledged. Supply stays held while the fault is present.","warning");}
      else {state.latched=false;emit("acknowledgement","Operator cleared the recovered alert. Supply released.");}
    } else emit("scenario",`${name} scenario activated.`);
    return control();
  }
  function step(dt=.25){
    if(!state.running)return snapshot();
    elapsed+=dt;
    const extra=Math.min(surge,300*dt);surge-=extra;
    const supplied=state.supplyOpen?Math.min(state.main,state.demand*dt):0;
    const volume=state.main+state.flow*dt+extra-supplied;
    const overflow=Math.max(0,volume-capacities.main);
    state.main=Math.min(capacities.main,Math.max(0,volume));
    if(overflow>0 && !state.overflowing)emit("overflow","Main tank overflow is entering the lower collection tank.","warning");
    state.overflowing=overflow>0;
    state.lower=Math.min(capacities.lower,Math.max(0,state.lower+overflow-(state.tap&&state.supplyOpen?60*dt:0)));
    if(state.lower>=capacities.lower*.95&&!state.lowerAlarm){state.lowerAlarm=true;emit("alarm","Lower tank level is high. Pump stopped.","warning");}
    if(state.lower<capacities.lower*.90)state.lowerAlarm=false;
    return control();
  }
  reset();
  return {reset,change,scenario,step,snapshot};
}
