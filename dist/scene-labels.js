// One nameplate per device. The shader corrects reading direction on its back face.
export function writeNameplate(mesh, id, { x, z, bottom, width, height, row }) {
  const half=width/2;
  const points=[[x-half,bottom,z],[x+half,bottom,z],
    [x+half,bottom+height,z],[x-half,bottom+height,z]];
  const uv=[[0,1,row],[1,1,row],[1,0,row],[0,0,row]];
  for(const triangle of [[0,1,2],[0,2,3]]) {
    for(const index of triangle) mesh.data.push(...points[index],...uv[index],23,id);
  }
}
