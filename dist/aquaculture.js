export const fishery = {
  id:"FISH-001",kind:"fishery",name:"Community fish farming",points:[[158,-3]],
  source:"Village livelihood proposal",confidence:"Illustrative proposal",
  notes:"Residents could raise and sell fish together. After paying for young fish, feed and upkeep, the group could share the remaining earnings."
};

// Position and heading of a shoal circulating in the open water between rafts.
export function fishPose(i,time){
  const phase=time*.17+i*.69,rx=7+i%4,rz=4+i%3;
  const x=rx*Math.cos(phase)+2*Math.sin(time*.23+i);
  const z=rz*Math.sin(phase)+(i%3-1)*2;
  const heading=Math.atan2(-rx*.17*Math.sin(phase)+.46*Math.cos(time*.23+i),rz*.17*Math.cos(phase));
  return [x,z,heading];
}
