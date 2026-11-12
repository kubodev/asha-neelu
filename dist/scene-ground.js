// World-space materials add illustrative surface detail without changing geography.
// One tile spans ~2 metres. Mipmaps and anisotropy filter detail at shallow angles.
export const groundShader = `
uniform sampler2D earthDetail;
uniform vec3 eyePosition;
uniform vec2 detailResolution;
float detailVisibility(float frequency) {
  float footprint=max(distance(eyePosition,world),detailResolution.y)*detailResolution.x;
  return 1.-smoothstep(.3,1.1,footprint*frequency);
}
vec3 earthSample() {
  vec2 p=world.xz*.16;
  vec3 fine=texture2D(earthDetail,p).rgb;
  vec3 broad=texture2D(earthDetail,mat2(.8,-.6,.6,.8)*p*.37+vec2(.31,.71)).rgb;
  return fine*(.86+.28*dot(broad,vec3(.333)));
}
vec3 detailedGround(vec3 reference, vec3 tintColor, float land) {
  if(imagery) return reference;
  vec3 soil=earthSample();
  float green=smoothstep(.012,.10,reference.g-reference.r);
  green=mix(green,smoothstep(.015,.09,tintColor.g-tintColor.r),land*.8);
  float patches=noise(world.xz*.31);
  float broadPatches=noise(world.xz*.055)*.6+noise(world.xz*.13)*.4;
  float growth=green*(.45+.55*smoothstep(.24,.72,patches));
  float grain=dot(soil,vec3(.333));
  vec3 grass=vec3(.39,.43,.27)*(.65+grain*.75);
  vec3 closeColor=mix(soil,grass,growth*.82);
  // Mapped plots keep their own colour, with world-space detail at every zoom.
  // The satellite supplies vegetation distribution only, never enlarged RGB pixels.
  vec3 plotColor=tintColor*(.79+.35*grain);
  closeColor=mix(closeColor,plotColor,land*.58);
  closeColor*=.88+.22*broadPatches;
  // The traced cultivated plot gets readable soil furrows at overview scale.
  // They are illustrative material detail, not a change to its boundary or use.
  if(surface>8.05 && surface<8.15) {
    float rows=pow(.5+.5*sin(world.x*1.02+world.z*.31),4.);
    float visible=1.-smoothstep(1400.,2800.,distance(eyePosition,world));
    closeColor*=1.-rows*.18*visible;
  }
  return closeColor;
}
vec3 detailedRoad(vec3 baseColor, vec3 reference, float paved) {
  if(imagery) return reference;
  vec3 soil=earthSample();
  float grain=dot(soil,vec3(.333));
  vec3 earth=soil*mix(vec3(1.),baseColor/vec3(.65,.58,.49),.35);
  // Existing paved roads get subdued aggregate; unconfirmed lanes remain dusty.
  vec3 asphalt=baseColor*(.78+.40*grain);
  asphalt+=vec3(.025)*noise(world.xz*.65);
  return mix(earth,asphalt,paved);
}
`;
