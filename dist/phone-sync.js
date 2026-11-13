// The optional local presentation server keeps the Supabase writer key off the map.
export function createPhoneSync(report) {
  if(!new URLSearchParams(location.search).has("phones"))return ()=>{};
  let queue=[],sending=false,lastSample=0,previous="";
  async function flush(){
    if(sending || !queue.length)return;
    sending=true;
    try{
      while(queue.length){
        const response=await fetch("/api/water",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(queue[0])});
        if(!response.ok)throw Error();
        queue.shift();
      }
    }catch{report("Phone sync waiting for the presentation server");setTimeout(flush,5000);}
    finally{sending=false;}
  }
  return state=>{
    const condition=!state.supplyOpen?(state.chlorine<.2?"low_chlorine":state.chlorine>1?"high_chlorine":state.turbidity>1?"cloudy":"held"):"open";
    const now=Date.now(),changed=condition!==previous;
    if(!changed && now-lastSample<5000)return;
    const entry={id:crypto.randomUUID(),main_pct:Math.round(state.main/100),lower_pct:Math.round(state.lower/30),
      chlorine:state.chlorine,condition,stats:{
        main:state.main,lower:state.lower,overflow:state.overflowLitres,overflowing:!!state.overflowing,
        solar:state.solar,kw:state.generation,kwh:state.solarKwh,used:state.usedPower,
        pump:state.pump,aerators:state.aerating,lights:state.lamps,tap:state.tap,
        inlet:state.flow,homes:state.homeFlow,delivered:state.delivered,river:state.riverFlow,
        ph:state.ph,turbidity:state.turbidity,sensor:state.sensor,dry:state.dryRun
      },alert:changed && (previous!=="" || condition!=="open")};
    previous=condition;lastSample=now;
    if(!entry.alert && queue.length>1 && !queue.at(-1).alert)queue.pop();
    queue.push(entry);flush();
  };
}
