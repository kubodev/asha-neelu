import test from "node:test";
import assert from "node:assert/strict";
import {createPhoneSync} from "../dist/phone-sync.js";
import {createIoTModel} from "../dist/iot-model.js";

test("tour state transitions publish ordered alerts once, independent of reading cadence",async()=>{
  globalThis.location={search:"?tour=1&phones=1"};
  const sent=[];
  globalThis.fetch=async(_,options)=>{sent.push(JSON.parse(options.body));return {ok:true};};
  const publish=createPhoneSync(assert.fail), model=createIoTModel();
  publish(model.snapshot());
  for(const action of ["cloudy","cloudy","recover","ack","chlorine"]){
    publish(model.scenario(action));
    publish(model.step());
  }
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sent.map(r=>[r.condition,r.alert]),[
    ["open",false],["cloudy",true],["held",true],["open",true],["low_chlorine",true]
  ]);
  assert.equal(sent[0].stats.main,4200);
  assert.equal(sent[0].stats.solar,85);
  assert.equal(sent[1].stats.pump,false);
  assert.equal(sent[1].stats.homes,0);
  assert.equal(new Set(sent.map(r=>r.id)).size,sent.length);
});
