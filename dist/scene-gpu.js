import {createVillageLife} from "./scene-residents.js";
import { cabinetLabels } from "./scene-electricity.js";
import { buildMeshes } from "./scene-mesh.js";
import { waterAppearance } from "./water.js";
import { groundShader } from "./scene-ground.js?v=depth-fix-2";

const vertex = `
attribute vec3 position, color;
attribute float material, feature, treeId;
attribute vec4 instance;
uniform mat4 camera, pose[10];
uniform vec3 fabric;
uniform vec3 eyePosition;
uniform bool tree;
uniform float time;
uniform vec2 iotAux;
varying vec3 world, tint;
varying float surface, objectId;
void main() {
  world = position;
  tint = color;
  surface = material;
  objectId = feature;
  if (tree) {
    float angle = treeId * 2.39996;
    vec2 p = mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*position.xz;
    world = vec3(instance.x+p.x*instance.z,position.y*instance.w,instance.y+p.y*instance.z);
    tint *= .94 + .1*fract(treeId*.128);
    objectId = treeId;
  }
  if(material>29.5 && material<30.5) {
    vec3 local=position-color;
    float angle=time*2.8*iotAux.x;
    world=color+vec3(local.x,local.y*cos(angle)-local.z*sin(angle),local.y*sin(angle)+local.z*cos(angle));
    tint=vec3(.22,.57,.62);
  }
  if(material>41.5 && material<42.5){
    vec3 sight=normalize(eyePosition-position);
    vec3 right=normalize(vec3(sight.z+.0001,0.,-sight.x));
    world+=(right*color.x+cross(sight,right)*color.y)*2.6;
  }
  if(material>=44.){
    int first=int(floor(feature/16.)),second=int(mod(floor(feature),16.));
    vec4 local=vec4(position,1.);
    world=mix(pose[first]*local,pose[second]*local,fract(feature)/.99).xyz;
    if(material>44.5)tint*=fabric;
    objectId=0.;
  }
  gl_Position = camera * vec4(world,1.);
}`;
const fragment = `
precision highp float;
varying vec3 world, tint;
varying float surface, objectId;
uniform bool picking, imagery;
uniform float time, selected;
uniform vec2 extent;
uniform vec3 waterStyle,fishWater;
uniform vec4 tankIoT, network;
uniform float tapFlow, riverFlow;
uniform vec2 iotAux;
uniform sampler2D terrain, overhead, cabinetAtlas;
float hash(vec2 p) {return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
${groundShader}
void main(){
  if (picking) {
    float id=floor(objectId+.5);
    gl_FragColor=vec4(mod(id,256.),mod(floor(id/256.),256.),floor(id/65536.),255.)/255.;
    return;
  }
  vec2 uv=world.xz/extent+.5;
  vec3 c=tint; float alpha=1.;
  if (surface<1.5) {
    c=detailedGround(texture2D(terrain,uv).rgb,c,0.);
  } else if (surface>3.5 && surface<4.5) {
    vec3 sampleColor=texture2D(overhead,uv).rgb;
    // Illustrative stagnant-water treatment; this is not a measured water test.
    vec2 p=world.xz;
    float broad=noise(p*.105)*.58+noise(p*.24)*.29+noise(p*.52)*.13;
    float matField=noise(p*.073+vec2(3.7,8.2))*.58+noise(p*.19)*.42;
    float mats=smoothstep(.48,.68,matField);
    float wisps=smoothstep(.54,.72,noise(p*.31+vec2(2.1,5.6)))*.25;
    float sediment=smoothstep(.35,.72,broad);
    vec3 stagnant=mix(vec3(.20,.20,.14),vec3(.34,.29,.18),sediment*.58);
    stagnant=mix(stagnant,vec3(.16,.24,.12),mats*.92);
    stagnant=mix(stagnant,vec3(.39,.37,.25),wisps);
    float sheen=sin(p.x*.63+p.y*.29+sin(p.y*.17))*sin(p.y*.51-p.x*.13);
    stagnant+=vec3(.025,.03,.018)*sheen*detailVisibility(.63);
    vec3 cleanWater=mix(vec3(.035,.31,.53),vec3(.10,.53,.69),broad*.55);
    float cleanRipple=sin(p.x*.48+time*.65+sin(p.y*.12))*sin(p.y*.44-time*.28);
    cleanWater+=vec3(.035,.07,.075)*cleanRipple*detailVisibility(.48);
    c=mix(stagnant,sampleColor,waterStyle.x*.12);
    c=mix(c,cleanWater,waterStyle.y);
    alpha=1.-fishWater.z*.65*(1.-smoothstep(13.,19.,distance(p,fishWater.xy)));
  } else if(surface>16.5 && surface<17.5) {
    float mud=noise(world.xz*.34)*.55+noise(world.xz*.91)*.3+noise(world.xz*2.7)*.15;
    c=mix(vec3(.22,.19,.13),vec3(.38,.32,.21),mud);
    float algae=noise(world.xz*.18+vec2(4.1,2.3));
    c=mix(c,vec3(.22,.27,.14),smoothstep(.57,.78,algae)*.48);
    c*=.96+.12*(noise(world.xz*4.)-.5)*detailVisibility(4.);
  } else if (surface>4.5 && surface<5.5) {
    vec2 p=world.xz+world.y*.8;
    float cluster=hash(floor(p*.55));
    c *= .98+(.16*(cluster-.5)+.10*(hash(floor(p*2.))-.5))*detailVisibility(2.);
  } else if (surface>5.5 && surface<6.5) {
    alpha=.36;
  } else if(surface>43.5){
    c=tint;
  } else if(surface>41.5){
    float r=length(tint.xy);
    if(surface<42.5){
      c=vec3(1.,.87,.52);alpha=(1.-smoothstep(.03,1.,r))*network.w*.72;
    }else{
      float wave=smoothstep(.3,1.,sin(r*24.-time*4.2));
      c=vec3(.66,.92,.92);alpha=wave*(1.-smoothstep(.22,1.,r))*iotAux.x*.5;
    }
  } else if(surface>33.5) {
    float enabled=tankIoT.z;
    bool electric=surface==36. || surface>=39.;
    if(surface==35.)enabled=network.y;
    if(surface==36.)enabled=network.x;
    if(surface==37.)enabled=network.z;
    if(surface==38.){enabled=tapFlow;if(enabled<.01)discard;}
    if(surface==40.)enabled=iotAux.x;
    if(surface==41.)enabled=network.w;
    float band=smoothstep(.57,.95,fract(tint.x/(electric?12.:5.)-time*(electric?1.8:1.15)));
    vec3 base=electric?vec3(.20,.19,.14):vec3(.04,.36,.54);
    vec3 lit=electric?vec3(1.,.77,.28):vec3(.48,1.,1.);
    c=mix(base,lit,(.22+.78*band)*enabled)*tint.y;
  } else if(surface>32.5 && surface<33.5) {
    c=tint; alpha=.12;
  } else if(surface>30.5 && surface<31.5) {
    float pulse=.5+.5*sin(world.y*6.+time*11.);
    c=mix(tint,vec3(.72,.90,.95),pulse*.45);
    alpha=tankIoT.z*.78;
  } else if(surface>31.5 && surface<32.5) {
    float ripple=sin(world.x*2.7+time*2.)*sin(world.z*2.3-time*1.6);
    c=tint+vec3(.04,.09,.10)*ripple*tankIoT.z;
    alpha=.23+.24*tankIoT.z;
  } else if(surface>27.5 && surface<28.5) {
    c=iotAux.y>.5 ? vec3(.1,.7,.3) : vec3(.9,.17,.1);
  } else if(surface>29.5 && surface<30.5) {
    c=tint;
  } else if(surface>24.5 && surface<26.5) {
    float mainGauge=surface<25.5 ? 1. : 0.;
    float level=mix(tankIoT.y,tankIoT.x,mainGauge);
    float bottom=mix(.7,10.7,mainGauge), top=mix(8.2,22.,mainGauge);
    c=world.y < mix(bottom,top,level) ? vec3(.05,.65,.88) : vec3(.12,.20,.24);
  } else if(surface>26.5 && surface<27.5) {
    c=tankIoT.w>.5 ? vec3(.95,.19,.1) : tankIoT.z>.5 ? vec3(.1,.92,.35) : vec3(.95,.69,.14);
  } else if(surface>23.5 && surface<24.5) {
    c=tint; alpha=.29*network.w;
  } else if(surface>22.5 && surface<23.5) {
    float labelU=gl_FrontFacing ? tint.x : 1.-tint.x;
    c=texture2D(cabinetAtlas,vec2(labelU,(tint.z+tint.y)/16.)).rgb;
  } else if(surface>21.5 && surface<22.5) {
    c=mix(vec3(.31,.34,.32),vec3(1.,.96,.69),network.w);
  } else if(surface>20.5 && surface<21.5) {
    c=mix(vec3(.08,.49,.85),vec3(.59,.96,1.),riverFlow*smoothstep(.45,.95,fract(tint.x/260.-time*.65))); alpha=.8;
  } else if(surface>19.5 && surface<20.5) {
    c=tint;
  } else if(surface>18.5 && surface<19.5) {
    float flow=sin(world.z*.06+world.x*.17+time*.4)*.018;
    c=tint+vec3(flow,flow,flow)+noise(world.xz*.025)*.035;
  } else if(surface>17.5 && surface<18.5) {
    float patch=noise(world.xz*.008)*.6+noise(world.xz*.026)*.4;
    c=earthSample()*(.94+patch*.15);
    c=mix(c,vec3(.46,.48,.29),smoothstep(.59,.81,patch)*.32);
  } else if(surface>14.5) {
    vec3 reference=mix(c,texture2D(overhead,uv).rgb,.43);
    c=detailedRoad(c,reference,surface<15.5 ? 1. : 0.);
  } else if(surface>9.5) {
    vec2 face=vec2(world.x+world.z*.73,world.y);
    float grain=mix(.5,noise(face*15.),detailVisibility(15.));
    if(surface<10.5) {
      float wear=noise(face*.63)*.6+noise(face*2.3)*.4;
      float damp=(1.-smoothstep(.3,2.4+noise(face*.4),world.y))*.19;
      float streak=noise(vec2(face.x*2.3,face.y*.14));
      c*=.89+.13*wear+.045*grain-damp;
      c=mix(c,vec3(.48,.46,.38),smoothstep(.70,.86,wear)*.28);
      c*=1.-.06*streak;
    } else if(surface<11.5) {
      c*=.86+.17*noise((world.xz+world.y)*1.3)+.06*grain;
    } else if(surface<12.5) {
      c*=.94+.06*grain;
    } else if(surface<13.5) {
      c*=.86+.15*noise(vec2(face.x*9.,face.y*.4));
    }
  } else if(surface>8.5) {
    vec3 roof = texture2D(overhead,uv).rgb;
    c=mix(c,roof*1.09,.77);
  } else if(surface>7.5) {
    vec3 reference=mix(texture2D(terrain,uv).rgb,c,.12);
    c=detailedGround(reference,c,1.);
  } else if(surface>6.5) {
    vec3 reference=mix(c,texture2D(overhead,uv).rgb,.43);
    c=detailedRoad(c,reference,0.);
  } else if (surface>1.5 && surface<3.5) {
    c*=.999+.028*(hash(floor((world.xz+world.y)*.7))-.5)*detailVisibility(.7);
  }
  if(selected>.5 && abs(objectId-selected)<.2) c=mix(c,vec3(.94,.69,.19),.20);
  gl_FragColor=vec4(c,alpha);
}`;
function makeShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
export function createGpu(canvas, features, extent, onAsset, onError) {
  const contextOptions = {
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  };
  const gl = canvas.getContext("webgl", contextOptions) ||
    canvas.getContext("webgl", {
      ...contextOptions,
      antialias: false,
      powerPreference: "default",
    });
  if (!gl)
    throw new Error(
      "3D rendering requires WebGL. Enable hardware acceleration or open the atlas in another browser.",
    );
  const program = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = makeShader(gl, type, src);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const attrs = Object.fromEntries(
    ["position", "color", "material", "feature", "instance", "treeId"].map(
      (k) => [k, gl.getAttribLocation(program, k)],
    ),
  );
  const u = Object.fromEntries(
    [
      "camera","pose","fabric",
      "extent",
      "terrain",
      "overhead",
      "tree",
      "time",
      "selected",
      "picking",
      "waterStyle","fishWater",
      "imagery",
      "earthDetail",
      "eyePosition",
      "cabinetAtlas",
      "tankIoT", "network", "tapFlow", "riverFlow",
      "iotAux",
      "detailResolution",
    ].map((k) => [k, gl.getUniformLocation(program, k)]),
  );
  gl.uniform2f(u.extent, extent.width, extent.depth);
  gl.uniform1i(u.terrain, 0);
  gl.uniform1i(u.overhead, 1);
  gl.uniform1i(u.earthDetail, 2);
  gl.uniform1i(u.cabinetAtlas, 3);
  gl.uniform4f(u.tankIoT,.42,.12,0,0);
  gl.uniform2f(u.iotAux,1,1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  const inst = gl.getExtension("ANGLE_instanced_arrays");
  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic") ||
    gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  let destroyed = false;
  function texture(name, repeat = false) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      1,
      1,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      new Uint8Array([166, 163, 140]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const img = new Image();
    img.onload = () => {
      if (destroyed) return;
      // WebGL 1 mipmaps require power-of-two dimensions.
      const tile = document.createElement("canvas");
      const cap = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      tile.width = Math.min(cap, 2 ** Math.ceil(Math.log2(img.width)));
      tile.height = Math.min(cap, 2 ** Math.ceil(Math.log2(img.height)));
      tile.getContext("2d").drawImage(img, 0, 0, tile.width, tile.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tile);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (repeat) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      }
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D,
        anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(16, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      onAsset();
    };
    img.onerror = () =>
      onError?.("The " + name + " terrain image could not be loaded.");
    img.src = new URL("./assets/" + name + (repeat ? ".png" : ".jpg"), import.meta.url).href;
    return tex;
  }
  const textures = [texture("ground"), texture("satellite"), texture("earth-detail", true)];
  const plateCanvas=document.createElement("canvas");
  plateCanvas.width=1024;
  plateCanvas.height=2048;
  const plateContext=plateCanvas.getContext("2d");
  plateContext.fillStyle="#e8edf0";
  plateContext.fillRect(0,0,1024,2048);
  cabinetLabels.forEach((label,index)=>{
    const y=index*128;
    plateContext.fillStyle="#263942";
    plateContext.textAlign="center";
    plateContext.textBaseline="middle";
    plateContext.font="bold 64px sans-serif";
    plateContext.fillText(label,512,y+48,980);
    plateContext.font="42px sans-serif";
    plateContext.fillText(index===0?"SOLAR DC INPUT":index===1?"DC → AC":index===3?"SENSORS + PUMP RELAY":index===2?"AC LIGHTING CIRCUIT":"WATER IoT MONITORING",512,y+100,940);
  });
  const cabinetTexture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,cabinetTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,plateCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  textures.push(cabinetTexture);

  let batches = {},
    instanceBuffer,
    instanceData = [];
  function buffer(values) {
    const handle = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, handle);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    return handle;
  }
  function releaseBuffers() {
    Object.values(batches).forEach((b) => gl.deleteBuffer(b.handle));
    if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
  }
  let hasFish=false;
  function update(items) {
    life.update(items);
    const fish=items.find(f=>f.kind==="fishery");
    hasFish=Boolean(fish);
    gl.uniform3f(u.fishWater,fish?.points[0][0]||0,fish?.points[0][1]||0,fish?1:0);
    releaseBuffers();
    const water = waterAppearance(items.find((f) => f.kind === "water"));
    gl.uniform3f(
      u.waterStyle,
      water.referenceMix,
      water.clarity,
      water.rippleStrength,
    );
    const { instances, ...geometry } = buildMeshes(items, extent);
    batches = Object.fromEntries(
      Object.entries(geometry).map(([key, b]) => [
        key,
        { handle: buffer(b.data), count: b.data.length / 8 },
      ]),
    );
    instanceData = instances;
    instanceBuffer = buffer(instances);
  }
  const bind = (attr, size, stride, offset) => {
    gl.enableVertexAttribArray(attrs[attr]);
    gl.vertexAttribPointer(attrs[attr], size, gl.FLOAT, false, stride, offset);
  };
  const life=createVillageLife(gl,bind,u,onAsset,onError);
  update(features);
  function batch(key, trees = false) {
    const b = batches[key];
    if (!b?.count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.handle);
    bind("position", 3, 32, 0);
    bind("color", 3, 32, 12);
    bind("material", 1, 32, 24);
    bind("feature", 1, 32, 28);
    gl.uniform1i(u.tree, trees ? 1 : 0);
    if (!trees) {
      gl.drawArrays(gl.TRIANGLES, 0, b.count);
      return;
    }
    if (inst) {
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      bind("instance", 4, 20, 0);
      bind("treeId", 1, 20, 16);
      for (const loc of [attrs.instance, attrs.treeId])
        inst.vertexAttribDivisorANGLE(loc, 1);
      inst.drawArraysInstancedANGLE(
        gl.TRIANGLES,
        0,
        b.count,
        instanceData.length / 5,
      );
      for (const loc of [attrs.instance, attrs.treeId]) {
        inst.vertexAttribDivisorANGLE(loc, 0);
        gl.disableVertexAttribArray(loc);
      }
    } else
      for (let i = 0; i < instanceData.length; i += 5) {
        gl.vertexAttrib4f(attrs.instance, ...instanceData.slice(i, i + 4));
        gl.vertexAttrib1f(attrs.treeId, instanceData[i + 4]);
        gl.drawArrays(gl.TRIANGLES, 0, b.count);
      }
  }
  function draw(matrix, layers, selected, time, pick = false) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(u.camera, false, matrix);
    gl.uniform1f(u.time, time);
    gl.uniform1f(u.selected, selected);
    gl.uniform1i(u.picking, pick ? 1 : 0);
    gl.uniform1i(u.imagery, layers.imagery ? 1 : 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, textures[3]);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures[2]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[layers.imagery ? 1 : 0]);
    batch("ground");
    if (!layers.imagery) batch("land");
    if (!pick) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      if (layers.buildings) batch("shadows");
      if (layers.vegetation) batch("canopyShadows");
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    if (layers.roads) batch("roads");
    batch("fence");
    batch("solar");
    batch("waterSystem");
    if (!pick) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    batch("electrical");
    gl.disable(gl.BLEND);
    if(layers.water){
      if(!pick && hasFish){
        // Lay down the pond colour, then composite the surface over the shoal.
        gl.depthMask(false);
        batch("water");
        gl.depthMask(true);
        life.drawFish(time);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      }
      batch("water");
      gl.disable(gl.BLEND);
    }
    if (layers.buildings) {
      batch("buildings");
      if (layers.outlines) batch("outlines");
    }
    if (layers.vegetation) {
      batch("tree", true);
      batch("fencePlants");
    }
    if (!pick) {
      life.draw(time);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      batch("filterFlow");
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    // Draw the underground route as a readable plan overlay across surface features.
    gl.disable(gl.DEPTH_TEST);
    if (!pick) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    batch("blueprint");
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  }
  function pick(matrix, layers, selected, time, x, y) {
    draw(matrix, layers, selected, time, true);
    const pixel = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    draw(matrix, layers, selected, time);
    return pixel[0] + pixel[1] * 256 + pixel[2] * 65536;
  }
  return {
    setTankIoT(values,aux,network,tap,river) { life.setCollection(!!tap && !!network[2]); gl.uniform4fv(u.tankIoT,values); gl.uniform2fv(u.iotAux,aux); gl.uniform4fv(u.network,network); gl.uniform1f(u.tapFlow,tap); gl.uniform1f(u.riverFlow,river); },
    setEye(eye,pixelScale,mapDistance) {
      gl.uniform3fv(u.eyePosition,eye);
      gl.uniform2f(u.detailResolution,pixelScale,mapDistance);
    },
    draw,
    pick,
    update,
    destroy() {
      destroyed = true;
      life.destroy();
      releaseBuffers();
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteProgram(program);
    },
  };
}
