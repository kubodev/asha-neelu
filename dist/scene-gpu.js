import { buildMeshes } from "./scene-mesh.js";
import { waterAppearance } from "./water.js";

const vertex = `
attribute vec3 position, color;
attribute float material, feature, treeId;
attribute vec4 instance;
uniform mat4 camera;
uniform bool tree;
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
  gl_Position = camera * vec4(world,1.);
}`;
const fragment = `
precision highp float;
varying vec3 world, tint;
varying float surface, objectId;
uniform bool picking, imagery;
uniform float time, selected;
uniform vec2 extent;
uniform vec3 waterStyle;
uniform sampler2D terrain, overhead;
float hash(vec2 p) {return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  if (picking) {
    float id=floor(objectId+.5);
    gl_FragColor=vec4(mod(id,256.),mod(floor(id/256.),256.),floor(id/65536.),255.)/255.;
    return;
  }
  vec2 uv=world.xz/extent+.5;
  vec3 c=tint; float alpha=1.;
  if (surface<1.5) {
    c=texture2D(terrain,uv).rgb;
  } else if (surface>3.5 && surface<4.5) {
    vec3 sampleColor=texture2D(overhead,uv).rgb;
    vec3 waterBase = mix(c,sampleColor,waterStyle.x);
    waterBase = mix(waterBase, vec3(.24,.27,.19), waterStyle.y);
    float wave=sin(world.x*.48+world.z*.17+time*.7+sin(world.z*.11))*sin(world.z*.49+time*.33);
    c=waterBase+vec3(.8,1.,1.02)*waterStyle.z*wave;
  } else if (surface>4.5 && surface<5.5) {
    vec2 p=world.xz+world.y*.8;
    float cluster=hash(floor(p*.55));
    c *= .87+.16*cluster+.10*hash(floor(p*2.));
  } else if (surface>5.5 && surface<6.5) {
    alpha=.36;
  } else if(surface>8.5) {
    vec3 roof = texture2D(overhead,uv).rgb;
    c=mix(c,roof*1.09,.77);
  } else if(surface>7.5) {
    c=mix(texture2D(terrain,uv).rgb,c,.12);
  } else if(surface>6.5) {
    c=mix(c,texture2D(overhead,uv).rgb,.43);
    c*=.97+.06*hash(floor(world.xz*1.4));
  } else if (surface>1.5 && surface<3.5) {
    c*=.985+.028*hash(floor((world.xz+world.y)*.7));
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
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
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
      "camera",
      "extent",
      "terrain",
      "overhead",
      "tree",
      "time",
      "selected",
      "picking",
      "waterStyle",
    ].map((k) => [k, gl.getUniformLocation(program, k)]),
  );
  gl.uniform2f(u.extent, extent.width, extent.depth);
  gl.uniform1i(u.terrain, 0);
  gl.uniform1i(u.overhead, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  const inst = gl.getExtension("ANGLE_instanced_arrays");
  let destroyed = false;
  function texture(name) {
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
      const cap = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      tile.width = Math.min(cap, 2 ** Math.round(Math.log2(img.width)));
      tile.height = Math.min(cap, 2 ** Math.round(Math.log2(img.height)));
      tile.getContext("2d").drawImage(img, 0, 0, tile.width, tile.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tile);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      onAsset();
    };
    img.onerror = () =>
      onError?.("The " + name + " terrain image could not be loaded.");
    img.src = new URL("./assets/" + name + ".jpg", import.meta.url).href;
    return tex;
  }
  const textures = [texture("ground"), texture("satellite")];
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
  function update(items) {
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
  update(features);
  const bind = (attr, size, stride, offset) => {
    gl.enableVertexAttribArray(attrs[attr]);
    gl.vertexAttribPointer(attrs[attr], size, gl.FLOAT, false, stride, offset);
  };
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
    if (layers.water) batch("water");
    if (layers.buildings) {
      batch("buildings");
      if (layers.outlines) batch("outlines");
    }
    if (layers.vegetation) batch("tree", true);
  }
  function pick(matrix, layers, selected, time, x, y) {
    draw(matrix, layers, selected, time, true);
    const pixel = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    draw(matrix, layers, selected, time);
    return pixel[0] + pixel[1] * 256 + pixel[2] * 65536;
  }
  return {
    draw,
    pick,
    update,
    destroy() {
      destroyed = true;
      releaseBuffers();
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteProgram(program);
    },
  };
}
