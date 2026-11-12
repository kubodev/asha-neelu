import { features, metersPerUnit } from "./geography.js";

export const regionalExtent = { width: 12000, depth: 16000 };
const reservoir = features.find(feature => feature.id === "W-001");
const center = reservoir.points.reduce((sum, point) => [
  sum[0] + point[0] / reservoir.points.length,
  sum[1] + point[1] / reservoir.points.length,
], [0, 0]);
const riverSouthBank = center[1] - 2000 / metersPerUnit;
const riverWidth = 150 / metersPerUnit;
// Gentle meanders span the landscape, with the intake anchored opposite the pond.
const southBankAt = x => {
  const offset = x - center[0];
  return riverSouthBank + Math.sin(offset / 1150) * 150 + Math.sin(offset / 2400) * 85;
};
const south = Array.from({ length: 81 }, (_, index) => {
  const x = -regionalExtent.width / 2 + index * regionalExtent.width / 80;
  return [x, southBankAt(x)];
});
const river = {
  id: "KRISHNA-001", name: "Krishna River · schematic location", kind: "river",
  points: [...south, ...south.map(([x,z]) => [x,z-riverWidth]).reverse()],
  source: "User-requested regional concept", confidence: "Illustrative proposal",
  notes: "Schematic Krishna River stretching across the northern landscape with gentle meanders, about 2 km north of the reservoir. Position and pipeline route are conceptual.",
};

// Sparse plantation clusters leave the added region predominantly sandy and open.
const planting = [];
for (let row=0;row<30;row++) {
  for (let column=0;column<24;column++) {
    const x=-5400+column*470+Math.sin(row*9+column)*95;
    const z=-7200+row*450+Math.cos(column*7+row)*70;
    if (Math.abs(x)<700 && Math.abs(z)<600) continue;
    if (Math.abs(x-center[0])<65 && z< -330 && z>riverSouthBank) continue;
    if (z < southBankAt(x) + 60 && z > southBankAt(x) - riverWidth - 60) continue;
    if ((column+row*3)%4===0) continue;
    planting.push({id:`REG-T-${row}-${column}`,name:"Regional plantation",kind:"tree",
      points:[[x,z]],width:18+(column%3)*5,height:22+(row%4)*4,
      source:"Regional landscape concept",confidence:"Illustrative proposal"});
  }
}
export const regionalFeatures = [river, ...planting];
export const riverPipeline = {
  id:"RIVER-PIPE-001", name:"Underground supply · blueprint route",kind:"pipe",
  points:[[center[0],riverSouthBank],[center[0],-330],[55,-330],[55,-170],[90,-170],[110,-125]],
  route:[[center[0],-4.5,riverSouthBank-35],[center[0],-4.5,riverSouthBank+45],
    [center[0],-4.5,-330],[55,-4.5,-330],[55,-4.5,-170],[90,-4.5,-170],
    [90,-4.5,-125],[110,-4.5,-125]],
  source:"User-requested supply concept",confidence:"Illustrative proposal",
  notes:"Dashed blue blueprint of the proposed underground river-to-reservoir supply. Route and burial depth are illustrative.",
  underground:true,
  blueprintWidth:12,
};
