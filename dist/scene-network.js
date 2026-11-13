// Each face carries distance along its route. Interpolation keeps the travelling
// highlight continuous around corners, including vertical risers.
export function networkLine(mesh,route,radius,material,id,distance=0) {
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],delta=b.map((v,k)=>v-a[k]);
    const length=Math.hypot(...delta);
    if(length<.001)continue;
    const [x,y,z]=delta.map(v=>v/length);
    const horizontal=Math.hypot(x,z);
    const u=horizontal>.001?[-z/horizontal,0,x/horizontal]:[1,0,0];
    const v=[y*u[2]-z*u[1],z*u[0]-x*u[2],x*u[1]-y*u[0]];
    const ring=(p,j)=>p.map((value,k)=>value+radius*(u[k]*Math.cos(j*Math.PI/3)+v[k]*Math.sin(j*Math.PI/3)));
    for(let j=0;j<6;j++){
      const face=[ring(a,j),ring(b,j),ring(b,j+1),ring(a,j+1)];
      for(const k of [0,1,2,0,2,3]){
        mesh.data.push(...face[k],distance+(k===1||k===2?length:0),.8+.2*Math.cos(j*Math.PI/3),0,material,id);
      }
    }
    distance+=length;
  }
}
