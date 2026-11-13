import { createGuidedTour } from "./guided-tour.js";
import { icon } from "./icons.js";
import { features as baseline, metersPerUnit, boundary } from "./geography.js";
import { photos, references } from "./photos.js";
import { createTankIoT } from "./tank-iot.js";
import { createScene } from "./scene.js?v=depth-fix-2";
import {
  stages,
  findings as reportedFindings,
  load,
  save,
  validate,
  empty,
  center,
  applyEdits,
} from "./configuration.js?v=fish-stage";
const $ = (id) => document.getElementById(id),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const attrs = (k, v) => " data-" + k + '="' + esc(v) + '"';
const btn = (act, label, ic = "", value = "", cls = "") =>
  '<button class="' +
  cls +
  '" data-action="' +
  act +
  '"' +
  attrs("value", value) +
  ">" +
  (ic ? icon(ic) : "") +
  label +
  "</button>";
const tool = (act, label, ic, value = "") =>
  '<button title="' +
  esc(label) +
  '" aria-label="' +
  esc(label) +
  '" data-action="' +
  act +
  '"' +
  attrs("value", value) +
  ">" +
  icon(ic) +
  "</button>";
const row = (act, label, ic, value) =>
  '<button class="quick-row" data-action="' +
  act +
  '"' +
  attrs("value", value) +
  '><span class="tile ' +
  ic +
  '">' +
  icon(ic, 16) +
  "</span>" +
  esc(label) +
  icon("right") +
  "</button>";
const list = (items) =>
  '<dl class="detail-list">' +
  items
    .map(
      ([k, v]) =>
        "<div><dt>" +
        esc(k) +
        "</dt><dd>" +
        esc(v || "Not provided") +
        "</dd></div>",
    )
    .join("") +
  "</dl>";
const modes = {
  orbit: ["Aerial orbit", "cube"],
  map: ["Top-down map", "map"],
  walk: ["3D Walkthrough", "walk"],
  fly: ["Free-fly", "fly"],
};
const layers = {
  buildings: ["Buildings", true],
  outlines: ["Building outlines", false],
  boundary: ["Study boundary", false],
  roads: ["Roads & paths", true],
  vegetation: ["Vegetation", true],
  water: ["Reservoir", true],
  labels: ["Landmark labels", true],
  photos: ["Photo markers", false],
  observations: ["Field observations", false],
  imagery: ["Source imagery", false],
};
let config,
  storageWarning = "";
try {
  config = load();
} catch {
  config = empty();
  storageWarning =
    "Browser storage could not be loaded. Using the supplied baseline.";
}
let tankIoT,guide;
function showStage(v){
  if(activeStage===Number(v))return;
  activeStage = Number(v);
  $("systems-button").hidden=activeStage<2;
  tankIoT?.setActive(activeStage>=2);
  document.querySelector(".stage-status").lastChild.textContent =
    " Stage " + v + " · " + stages.find(stage => stage.id === activeStage).title;
  document.querySelectorAll(".stage").forEach(button => {
    const current=Number(button.dataset.value) === activeStage;
    button.classList.toggle("current", current);
    button.setAttribute("aria-pressed",String(current));
    if(current)button.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"});
  });
  selected = null;
  data = applyEdits(config, activeStage);
  scene?.setFeatures(data);
  $("fish-income").hidden=activeStage!==3;
  if(activeStage===3)$("fish-income").querySelector("p").textContent=feature("FISH-001").notes;
  overview();
  drawPins();
}

let activeStage = 1;
let data = applyEdits(config, activeStage),
  scene,
  mode = "orbit",
  selected = null,
  lastCamera,
  stop = -1,
  interval,
  photoSet = [],
  history = [],
  toastTimer,
  pinFrame,
  dialogKind = "",
  returnToLibrary = false;
const feature = (id) => data.find((f) => f.id === id);
const iconFor = (f) =>
  ({
    water: "water",
    road: "road",
    building: "building",
    landmark: "temple",
    tree: "tree",
    land: "map",
  })[f?.kind] || "pin";
document
  .querySelectorAll("[data-i]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.i)));
function toast(s) {
  $("toast").textContent = s;
  $("toast").className = "visible";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").className = ""), 3200);
}
function nav(tab = "explore") {
  $("nav").innerHTML = [
    ["explore", "Explorer", "map"],
    ["library", "References", "photo"],
    ["findings", "Field findings", "notes"],
  ]
    .map(([a, l, i]) => btn(a, l, i, "", a === tab ? "active" : ""))
    .join("");
}
function modal(title, html, kind = "") {
  if (interval) {
    halt();
    tourBar();
  }
  $("dialog-title").textContent = title;
  $("dialog-body").innerHTML = html;
  dialogKind = kind;
  if (!$("dialog").open) $("dialog").showModal();
}
function close() {
  if ($("dialog").open) $("dialog").close();
}
$("dialog").addEventListener("close", () => {
  nav();
  dialogKind = "";
});
$("dialog").onclick = (e) => {
  if (e.target === $("dialog")) close();
};
function overview() {
  selected = null;
  scene?.setSelected(null);
  $("panel-title").textContent = "Site overview";
  $("side-content").innerHTML =
    '<button class="site-photo" data-action="photo" data-value="ref-08" title="Open street reference"><img src="./assets/roadside.jpg" alt="Shops and a fenced plot along the bank-side lane in Malkapuram"><span class="photo-tag">' +
    icon("camera") +
    ' Street reference</span></button><section class="side-section"><div class="kicker">STUDY AREA</div><h3>Malkapuram</h3><p>Explore the reservoir, residential lanes and open land along Vijayawada–Amaravathi Road.</p><div class="datum-row"><div><strong>3.53 ha</strong><small>Study boundary</small></div><div><strong>20</strong><small>Site references</small></div></div></section><section class="side-section"><div class="section-head"><h3>Places to explore</h3>' +
    tool("search", "Find a feature", "search") +
    "</div>" +
    [
      ["W-001", "Village reservoir"],
      ["L-001", "Malkapuram pillar"],
      ["R-005", "Residential street"],
    ]
      .map(([id, n]) => row("focus", n, iconFor(feature(id)), id))
      .join("") +
    '</section><section class="side-section">' +
    btn("editor", "Working configuration", "edit", "", "text-btn") +
    "</section>";
}
function inspect(f, focus = false) {
  if (!f) {
    overview();
    return;
  }
  selected = f.id;
  scene?.setSelected(f);
  if (focus) scene?.focus(f);
  document.querySelector(".workspace").classList.remove("collapsed");
  $("panel-title").textContent = "Feature details";
  let properties = [
    ["Feature ID", f.id],
    ["Type", f.kind === "building" ? "Not provided" : f.kind],
    ["Confidence", f.confidence],
    ["Source", f.source],
  ];
  if (f.kind === "building") {
    const edges = f.points.map(
      (p, i) =>
        Math.hypot(
          p[0] - f.points[(i + 1) % f.points.length][0],
          p[1] - f.points[(i + 1) % f.points.length][1],
        ) * metersPerUnit,
    );
    properties.push(
      ["Approx. longest edge", Math.max(...edges).toFixed(1) + " m"],
      ["Approx. model height", (f.height * metersPerUnit).toFixed(1) + " m"],
    );
  }
  if (f.surface) properties.push(["Surface", f.surface]);
  const sourceButtons = references
    .filter((ref) =>
      new RegExp("\\b" + ref.id.slice(4) + "\\b").test(f.source || ""),
    )
    .map(
      (ref) =>
        '<button data-action="library-photo" data-value="' +
        ref.id +
        '" title="' +
        esc(ref.title) +
        '"><img src="' +
        esc(ref.thumb) +
        '" alt="' +
        esc(ref.title) +
        '"></button>',
    )
    .join("");
  $("side-content").innerHTML =
    '<section class="side-section">' +
    btn("overview", "Site overview", "left", "", "text-btn") +
    '<div style="margin-top:16px" class="kicker">' +
    esc(f.kind.toUpperCase()) +
    "</div><h3>" +
    esc(f.name) +
    "</h3>" +
    list(properties) +
    "<p>" +
    esc(f.notes || "Notes · Not provided") +
    '</p><p class="minor" style="margin:10px 0">Attached photographs · Not provided</p><div class="row">' +
    btn("focus", "Orbit here", "target", f.id) +
    btn("edit-feature", "Edit feature", "edit", f.id) +
    "</div>" +
    (sourceButtons
      ? '<h3 class="group-head">Source references</h3><div class="source-strip">' +
        sourceButtons +
        "</div>"
      : "") +
    "</section>";
}
function refresh() {
  data = applyEdits(config, activeStage);
  scene?.setFeatures(data);
  if (selected && feature(selected)) inspect(feature(selected));
  else overview();
  drawPins();
}
function change(mut) {
  const copy = structuredClone(config);
  mut(copy);
  try {
    validate(copy);
    save(copy);
  } catch (e) {
    toast(e.message);
    return false;
  }
  history.push(config);
  if (history.length > 40) history.shift();
  config = copy;
  refresh();
  return true;
}
function showAbout() {
  modal(
    "About this model",
    '<div class="info-text"><div class="kicker">STAGE 1 · CURRENT SITUATION</div><p>The model covers the measured Malkapuram study boundary and its immediate surroundings. The supplied measurement is 35,317.76 m². Map distances use an approximate local scale.</p><h3 class="group-head">Source imagery</h3><p>Six overhead and map references establish the shoreline, streets, roof outlines and landmark labels. Fourteen ground views document visible materials and road conditions. Most dated street views are from September 2026. One lane view is from July 2022. Satellite capture dates are unknown.</p><h3 class="group-head">Reading the reconstruction</h3><p>Labelled landmarks are confirmed by the supplied maps. Roof outlines, road alignments and tree clusters are visually inferred. Heights, hidden façades, terrain and photo positions are approximate. Image-up is assumed north.</p><p>The reservoir surface is an illustrative stagnant-water treatment representing reported water-quality concerns; it is not a test result or verified assessment. Water quality and household connections require independent field evidence.</p></div><div class="row">' +
      btn("library", "Reference library", "photo") +
      btn("editor", "Working configuration", "edit") +
      "</div>",
    "about",
  );
}
function findings() {
  nav("findings");
  modal(
    "Field findings",
    '<div class="kicker">VILLAGE-WIDE OBSERVATIONS</div>' +
      reportedFindings
        .map(
          ({ title: t, description: d }) =>
            '<article class="article"><h3>' +
            esc(t) +
            "</h3><p>" +
            esc(d) +
            "</p><small>Reported · Project presentation · Date not provided</small></article>",
        )
        .join("") +
      '<p class="minor" style="margin-top:12px">Geographic scope covers the village. Related photographs and household locations were not provided.</p>',
    "findings",
  );
}
function library() {
  nav("library");
  function group(title, items) {
    return (
      '<h3 class="group-head">' +
      title +
      ' <span class="minor">(' +
      items.length +
      ')</span></h3><div class="photo-grid">' +
      items
        .map(
          (p) =>
            '<button data-action="library-photo"' +
            attrs("value", p.id) +
            '><img loading="lazy" src="' +
            esc(p.thumb) +
            '" alt=""><span>' +
            esc(p.title) +
            "</span></button>",
        )
        .join("") +
      "</div>"
    );
  }
  modal(
    "Reference library",
    group("Street photographs", photos) +
      group("Overhead & map references", references),
    "library",
  );
}
function photo(id, fromLibrary = false, keep = false) {
  const p = [...photos, ...references].find((v) => v.id === id);
  if (!p) return;
  if (!keep) {
    photoSet = fromLibrary
      ? photos.includes(p)
        ? photos
        : references
      : photos.filter((x) => x.group === p.group);
    returnToLibrary = fromLibrary;
  }
  const idx = photoSet.indexOf(p);
  modal(
    p.title,
    '<img class="viewer-img" src="' +
      esc(p.src) +
      '" alt="' +
      esc(p.title) +
      '"><p class="body-copy" style="margin:12px 0">' +
      esc(p.description) +
      "</p>" +
      list([
        ["Source", p.source],
        ["Capture date", p.date],
        ["Location confidence", p.confidence],
        ["View direction", p.direction],
      ]) +
      '<div class="row spread">' +
      btn("library", "Reference library", "photo") +
      '<div class="row">' +
      tool("prev-photo", "Previous photograph", "left", idx) +
      '<span class="minor">' +
      (idx + 1) +
      " / " +
      photoSet.length +
      "</span>" +
      tool("next-photo", "Next photograph", "right", idx) +
      "</div></div>",
    "photo",
  );
}
function setMode(value) {
  if (!modes[value]) return;
  mode = value;
  scene?.setMode(value);
  modeUI();
  menus();
  drawPins();
}
function modeUI() {
  $("mode").innerHTML =
    icon(modes[mode][1]) + modes[mode][0] + icon("down", 13);
  $("hint").textContent =
    mode === "map"
      ? "Drag to pan · Scroll to zoom"
      : mode === "orbit"
        ? "Drag to orbit · Scroll to zoom"
        : "WASD to move · Drag to look";
  const walking = ["walk", "fly"].includes(mode);
  $("movement").hidden = !walking;
  if (walking)
    $("movement").innerHTML =
      btn("look", "Mouse-look", "eye") +
      '<label>Speed <input type="range" id="speed" aria-label="Movement speed" min="0.3" max="3" step=".1" value="' +
      (lastCamera?.speed || 1) +
      '"></label><div class="touchpad">' +
      [
        "forward",
        "back",
        "left",
        "right",
        ...(mode === "fly" ? ["up", "down"] : []),
      ]
        .map((d, i) => btn("move", ["↑", "↓", "←", "→", "＋", "−"][i], "", d))
        .join("") +
      "</div>" +
      btn("exit-mode", "Exit", "x");
}
function menus(open) {
  for (const k of ["mode", "layer"]) $(k + "-menu").hidden = k !== open;
}
function drawPins() {
  cancelAnimationFrame(pinFrame);
  pinFrame = requestAnimationFrame(() => {
    if (!scene || guide?.active) return;
    const parent = $("pins"),
      entries = [],
      occupied = [];
    if (layers.labels[1] && ["map", "orbit"].includes(mode)) {
      for (const id of [
        "W-001",
        "KRISHNA-001",
        ...(lastCamera?.distance > 2500 && activeStage >= 2 ? ["RIVER-PIPE-001"] : []),
        "L-001",
        "R-005",
        ...(lastCamera?.distance < 950 ? ["L-002", "L-003"] : []),
      ]) {
        const f = feature(id);
        if (
          !f ||
          (f.kind === "water" && !layers.water[1]) ||
          (f.kind === "road" && !layers.roads[1])
        )
          continue;
        const [x, z] = center(f);
        entries.push([
          id,
          scene.project(x, z, f.kind === "iotDevice" ? f.height+2 : 5),
          config.overrides[id]?.name ||
            {
              "W-001": "Reservoir",
              "L-001": "Malkapuram pillar",
              "R-005": "Residential street",
            }[id] ||
            f.name,
          iconFor(f),
          "focus",
          f.kind,
        ]);
      }
    }
    if (layers.photos[1]) {
      const seen = new Set();
      for (const p of [
        ...config.photoMarkers.map((m) => ({
          id: m.photo,
          location: [m.x, m.z],
          title: m.title,
        })),
        ...photos.filter(
          (p) => !config.photoMarkers.some((m) => m.id === p.id),
        ),
      ]) {
        if (!p.location || seen.has(p.location.join())) continue;
        seen.add(p.location.join());
        entries.unshift([
          p.id,
          scene.project(...p.location, 6),
          "",
          "camera",
          "photo",
          "photo",
          p.title,
        ]);
      }
    }
    const w = parent.clientWidth,
      h = parent.clientHeight;
    parent.replaceChildren();
    if (layers.boundary[1] && ["orbit", "map"].includes(mode)) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.position = "absolute";
      const points = boundary.map(([x, z]) => scene.project(x, z, 1.2));
      if (points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
        const line = document.createElementNS(svg.namespaceURI, "polygon");
        line.setAttribute(
          "points",
          points.map((p) => p.x + "," + p.y).join(" "),
        );
        line.setAttribute("fill", "none");
        line.setAttribute("stroke", "#f2ce82");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-dasharray", "6 4");
        svg.append(line);
        parent.append(svg);
      }
    }
    for (const [id, p, label, ic, act, cls, title] of entries) {
      if (!p?.visible || p.x < 25 || p.x > w - 25 || p.y < 62 || p.y > h - 28)
        continue;
      const wid = label.length * 3 + 17;
      if (
        occupied.some(
          ([x, y, v]) => Math.abs(x - p.x) < wid + v && Math.abs(y - p.y) < 30,
        )
      )
        continue;
      occupied.push([p.x, p.y, wid]);
      const el = document.createElement("button");
      el.className = "map-pin " + cls;
      el.dataset.action = act;
      el.dataset.value = id;
      el.title = label || "Open photograph · " + title;
      el.style.left = p.x + "px";
      el.style.top = p.y - 8 + "px";
      el.innerHTML = icon(ic) + esc(label);
      parent.append(el);
    }
    if (layers.observations[1]) {
      const b = document.createElement("button");
      b.className = "map-pin";
      b.style.cssText = "top:63px;left:15px;transform:none";
      b.dataset.action = "findings";
      b.textContent = "5 village-wide findings";
      parent.append(b);
    }
    if (mode === "map") {
      const a = scene.project(0, 0, 0),
        b = scene.project(20 / metersPerUnit, 0, 0),
        width = Math.hypot(b.x - a.x, b.y - a.y);
      $("scale").innerHTML =
        width < 200 ? '≈ 20 m <span style="width:' + width + 'px"></span>' : "";
    } else $("scale").innerHTML = "";
  });
}
function editor() {
  modal(
    "Working configuration",
    '<div class="info-text"><p>Corrections are saved in this browser. Export a copy to move them to another device. The supplied baseline stays available.</p></div><div class="article"><h3>Feature corrections</h3><p>Select a building, road or landmark to edit its position, shape, name and notes.</p>' +
      btn("search", "Choose a feature", "search") +
      '</div><div class="article"><h3>Photo markers</h3><p>Place an existing reference at local map coordinates.</p>' +
      btn("marker", "Add or move a marker", "pin") +
      '</div><div class="article"><h3>Tour bookmarks</h3><p>Save the current camera or revise an existing stop.</p>' +
      btn("bookmarks", "Edit bookmarks", "edit") +
      '</div><div class="row" style="margin-top:16px">' +
      btn("undo", "Undo last change", "left") +
      btn("export", "Export JSON") +
      btn("import", "Import JSON") +
      btn("baseline", "Restore baseline") +
      "</div>",
    "editor",
  );
}
function search(q = "") {
  if (dialogKind !== "search")
    modal(
      "Find a feature",
      '<input class="search" id="query" aria-label="Search features" placeholder="Search by name, type or ID"><div id="results"></div>',
      "search",
    );
  let matches = data.filter((f) =>
    [f.name, f.id, f.kind].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  $("results").innerHTML =
    matches
      .slice(0, 55)
      .map((f) => row("focus", f.name + " · " + f.id, iconFor(f), f.id))
      .join("") || '<p class="article">No matching features.</p>';
}
const input = (name, label, val, type = "text", opts = "") =>
  "<label>" +
  esc(label) +
  '<input name="' +
  name +
  '" type="' +
  type +
  '" value="' +
  esc(val) +
  '" ' +
  opts +
  "></label>";
function editFeature(id) {
  const f = baseline.find((f) => f.id === id),
    o = config.overrides[id] || {};
  if (!f) return;
  modal(
    "Edit " + id,
    '<form class="editor" id="feature-form" data-id="' +
      id +
      '">' +
      input(
        "name",
        "Display name",
        o.name ?? f.name,
        "text",
        'required maxlength="160"',
      ) +
      '<label>Notes<textarea name="notes" maxlength="2000">' +
      esc(o.notes ?? f.notes ?? "") +
      '</textarea></label><div class="editor-grid">' +
      input(
        "dx",
        "East offset (local units)",
        o.dx || 0,
        "number",
        'step="any" required min="-1000" max="1000"',
      ) +
      input(
        "dz",
        "South offset (local units)",
        o.dz || 0,
        "number",
        'step="any" required min="-763" max="763"',
      ) +
      input(
        "rotation",
        "Rotation (degrees)",
        o.rotation || 0,
        "number",
        'step="any" required min="-360" max="360"',
      ) +
      input(
        "size",
        "Footprint scale",
        o.size || 1,
        "number",
        'step="any" required min=".1" max="5"',
      ) +
      (f.height
        ? input(
            "height",
            "Approximate height (m)",
            ((o.height ?? f.height) * metersPerUnit).toFixed(2),
            "number",
            'step=".01" required min=".1" max="50"',
          )
        : "") +
      '</div><p class="minor">One local unit is approximately ' +
      metersPerUnit.toFixed(3) +
      ' metres.</p><button class="primary" type="submit">Save correction</button></form>',
    "feature",
  );
}
function markerForm(id) {
  const options = [
    ...photos.map((p) => ({
      id: p.id,
      photo: p.id,
      title: p.title,
      x: p.location?.[0] || 0,
      z: p.location?.[1] || 0,
    })),
    ...config.photoMarkers.filter((m) => !photos.some((p) => p.id === m.id)),
  ];
  const m =
    config.photoMarkers.find((m) => m.id === id) ||
    options.find((p) => p.id === id) ||
    options[0];
  modal(
    "Photo markers",
    '<form id="marker-form" class="editor"><label>Marker<select id="marker-id">' +
      options
        .map(
          (p) =>
            '<option value="' +
            p.id +
            '" ' +
            (p.id === m.id ? "selected" : "") +
            ">" +
            esc(p.title) +
            "</option>",
        )
        .join("") +
      '<option value="new">Add another marker…</option></select></label><label>Reference photograph<select name="photo">' +
      photos
        .map(
          (p) =>
            '<option value="' +
            p.id +
            '" ' +
            (p.id === m.photo ? "selected" : "") +
            ">" +
            esc(p.title) +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      input(
        "title",
        "Marker name",
        m.title,
        "text",
        'required maxlength="160"',
      ) +
      '<div class="editor-grid">' +
      input(
        "x",
        "East coordinate",
        m.x,
        "number",
        'step="any" required min="-500" max="500"',
      ) +
      input(
        "z",
        "South coordinate",
        m.z,
        "number",
        'step="any" required min="-381.5" max="381.5"',
      ) +
      '</div><p class="minor">Coordinates are local units from the map centre. Positive values run east and south.</p><button class="primary">Save marker</button></form>',
    "marker",
  );
}
function bookmarks() {
  modal(
    "Tour bookmarks",
    '<p class="body-copy">Rename a stop, change its order or replace its camera with your current view.</p>' +
      config.bookmarks
        .map(
          (b, i) =>
            '<div class="article"><strong>' +
            esc(b.name) +
            '</strong><div class="row">' +
            btn("bookmark-edit", "Edit", "edit", i) +
            (i ? btn("bookmark-up", "Move earlier", "left", i) : "") +
            (config.bookmarks.length > 1
              ? btn("bookmark-delete", "Remove", "x", i)
              : "") +
            "</div></div>",
        )
        .join("") +
      '<div class="row" style="margin-top:14px">' +
      btn("bookmark-add", "Save current view", "plus") +
      "</div>",
    "bookmarks",
  );
}
function bookmarkEdit(i) {
  const b = config.bookmarks[i];
  modal(
    "Edit bookmark",
    '<form id="bookmark-form" data-index="' +
      i +
      '" class="editor">' +
      input(
        "name",
        "Stop name",
        b?.name || "New viewpoint",
        "text",
        'required maxlength="150"',
      ) +
      (b
        ? '<label><span><input type="checkbox" name="useCamera"> Replace with current camera</span></label>'
        : "") +
      '<button class="primary">Save bookmark</button></form>',
    "bookmark",
  );
}
function halt() {
  clearInterval(interval);
  interval = null;
}
function endTour() {
  halt();
  stop = -1;
  $("tourbar").hidden = true;
}
function tourAt(idx) {
  stop = (idx + config.bookmarks.length) % config.bookmarks.length;
  const b = config.bookmarks[stop];
  if (b.camera) {
    scene?.setCamera(b.camera);
    mode = b.camera.mode;
    modeUI();
  } else {
    setMode("orbit");
    b.feature ? scene?.focus(feature(b.feature)) : scene?.fit();
  }
  tourBar();
}
function tourBar() {
  $("tourbar").hidden = false;
  $("tourbar").innerHTML =
    tool("tour-prev", "Previous stop", "left") +
    tool(
      "tour-play",
      interval ? "Pause tour" : "Play tour",
      interval ? "pause" : "play",
    ) +
    "<span>" +
    esc(
      stop +
        1 +
        " / " +
        config.bookmarks.length +
        " · " +
        config.bookmarks[stop].name,
    ) +
    "</span>" +
    tool("tour-next", "Next stop", "right") +
    tool("tour-exit", "Exit tour", "x");
}
function play() {
  halt();
  interval = setInterval(() => {
    if (stop >= config.bookmarks.length - 1) {
      halt();
      tourBar();
    } else tourAt(stop + 1);
  }, 6500);
  tourBar();
}
function help() {
  modal(
    "Explorer controls",
    '<div class="info-text"><h3>Aerial orbit</h3><p>Drag to rotate and tilt. Shift-drag or right-drag to pan. Scroll to zoom. On touchscreens, use two fingers to pan and pinch.</p><h3>3D Walkthrough & free-fly</h3><p>Use WASD or the arrows to move. Hold Shift to move faster. Drag to look around or activate Mouse-look. Escape releases the mouse. In free-fly, Q lowers and E raises the camera.</p><h3>Find your bearings</h3><p>Use the compass to face north. Fit village restores the overhead view. Select a map feature to inspect its evidence or save a correction.</p></div><div class="article row"><label>Render quality <select id="quality"><option>low</option><option selected>medium</option><option>high</option></select></label>' +
      btn("present", "Presentation mode", "monitor") +
      btn("full", "Fullscreen", "full") +
      "</div>" +
      btn("editor", "Working configuration", "edit"),
    "help",
  );
  $("quality").value = quality;
}
let quality = "high";
function exportFile() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "malkapuram-working-configuration.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    try {
      if (input.files[0].size > 2000000)
        throw Error("Choose a configuration smaller than 2 MB.");
      const c = validate(JSON.parse(await input.files[0].text()));
      if (change((o) => Object.assign(o, c))) {
        editor();
        toast("Configuration imported");
      }
    } catch (e) {
      toast(e.message);
    }
  };
  input.click();
}
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target,
    v = Object.fromEntries(new FormData(form));
  if (form.id === "feature-form") {
    const id = form.dataset.id;
    if (
      change((c) => {
        c.overrides[id] = {
          name: v.name,
          notes: v.notes,
          dx: +v.dx,
          dz: +v.dz,
          rotation: +v.rotation,
          size: +v.size,
          ...(v.height ? { height: +v.height / metersPerUnit } : {}),
        };
      })
    ) {
      close();
      toast("Feature correction saved");
    }
  } else if (form.id === "marker-form") {
    const id =
      $("marker-id").value === "new"
        ? "marker-" + Date.now()
        : $("marker-id").value;
    if (
      change((c) => {
        c.photoMarkers = c.photoMarkers.filter((p) => p.id !== id);
        c.photoMarkers.push({
          id,
          photo: v.photo,
          title: v.title,
          x: +v.x,
          z: +v.z,
        });
      })
    ) {
      layers.photos[1] = true;
      close();
      drawPins();
      toast("Photo marker saved");
    }
  } else if (form.id === "bookmark-form") {
    const i = +form.dataset.index;
    if (
      change((c) => {
        if (i < 0)
          c.bookmarks.push({ name: v.name, camera: scene.getCamera() });
        else {
          c.bookmarks[i].name = v.name;
          if (v.useCamera)
            c.bookmarks[i] = { name: v.name, camera: scene.getCamera() };
        }
      })
    )
      bookmarks();
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "query") search(el.value);
  if (el.id === "speed") scene?.setSpeed(+el.value);
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.layer) {
    layers[el.dataset.layer][1] = el.checked;
    scene?.setLayer(el.dataset.layer, el.checked);
    drawPins();
  }
  if (el.id === "quality") {
    quality = el.value;
    scene?.setQuality(quality);
  }
  if (el.id === "marker-id" && el.value !== "new") markerForm(el.value);
});
function togglePanel() {
  document.querySelector(".workspace").classList.toggle("collapsed");
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!e.target.closest(".map-dropdown")) menus();
  if (!b) return;
  const a = b.dataset.action,
    v = b.dataset.value;
  switch (a) {
    case "explore":
      close();
      break;
    case "close":
      close();
      break;
    case "overview":
      overview();
      break;
    case "about":
      showAbout();
      break;
    case "library":
      library();
      break;
    case "findings":
      findings();
      break;
    case "iot":
      if(activeStage<2) document.querySelector('[data-action="stage"][data-value="2"]').click();
      $("map-controls").hidden=true;
      $("toggle-map-tools").setAttribute("aria-expanded","false");
      document.querySelector(".workspace").classList.add("collapsed");
      tankIoT?.open();
      scene?.focus(feature("TANK-001"));
      break;
    case "help":
      help();
      break;
    case "reload-3d":
      window.location.reload();
      break;
    case "photo":
    case "library-photo":
      photo(v, a === "library-photo");
      break;
    case "next-photo":
    case "prev-photo":
      photo(
        photoSet[
          (+v + (a === "next-photo" ? 1 : -1) + photoSet.length) %
            photoSet.length
        ].id,
        returnToLibrary,
        true,
      );
      break;
    case "map-tools": {
      const controls=$("map-controls");
      controls.hidden=!controls.hidden;
      $("toggle-map-tools").setAttribute("aria-expanded",String(!controls.hidden));
      break;
    }
    case "mode":
      menus($("mode-menu").hidden ? "mode" : null);
      break;
    case "layers":
      $("layer-menu").innerHTML = Object.entries(layers)
        .map(
          ([k, [label, on]]) =>
            '<label><input type="checkbox" data-layer="' +
            k +
            '" ' +
            (on ? "checked" : "") +
            ">" +
            label +
            "</label>",
        )
        .join("");
      menus($("layer-menu").hidden ? "layer" : null);
      break;
    case "set-mode":
      endTour();
      setMode(v);
      $("scene").focus();
      break;
    case "exit-mode":
    case "fit":
      endTour();
      setMode("orbit");
      scene?.fit();
      overview();
      break;
    case "north":
      scene?.north();
      break;
    case "zoom":
      scene?.zoom(+v);
      break;
    case "look":
      scene?.activateLook();
      break;
    case "move":
      scene?.move(v);
      break;
    case "region":
      setMode("orbit");
      scene?.setCamera({ mode:"orbit", target:[0,0,-3000], yaw:0, pitch:1.25, distance:14500 });
      break;
    case "sidebar":
      togglePanel();
      break;
    case "focus":
      close();
      endTour();
      if (!["map", "orbit"].includes(mode)) setMode("orbit");
      inspect(feature(v), true);
      break;
    case "search":
      search();
      $("query").focus();
      break;
    case "tour":
      endTour();
      $("start-guide").click();
      break;
    case "tour-play":
      if (interval) {
        halt();
        tourBar();
      } else play();
      break;
    case "tour-prev":
    case "tour-next":
      halt();
      tourAt(stop + (a === "tour-next" ? 1 : -1));
      break;
    case "tour-exit":
      endTour();
      break;
    case "full":
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        toast("Fullscreen is unavailable in this browser.");
      }
      break;
    case "present":
      close();
      document.body.classList.toggle("present");
      break;
    case "stage":
      if (stages.some(s => String(s.id) === v && s.available)) {
        guide?.stop();
        showStage(Number(v));
        if(activeStage===3){
          const [x,z]=feature("FISH-001").points[0];
          setMode("orbit");
          scene?.setCamera({mode:"orbit",target:[x,0,z],yaw:-.44,pitch:.91,distance:42});
        }else toast("Stage " + v + " · " + stages.find(s=>s.id===activeStage).title);
      } else {
        toast("Stage " + v + " · Not built yet");
      }
      break;
    case "editor":
      editor();
      break;
    case "edit-feature":
      editFeature(v);
      break;
    case "marker":
      markerForm();
      break;
    case "bookmarks":
      bookmarks();
      break;
    case "bookmark-add":
      if (!scene) {
        toast("A working 3D view is required to capture a camera bookmark.");
        break;
      }
      bookmarkEdit(-1);
      break;
    case "bookmark-edit":
      bookmarkEdit(+v);
      break;
    case "bookmark-delete":
      if (change((c) => c.bookmarks.splice(+v, 1))) bookmarks();
      break;
    case "bookmark-up":
      if (
        change((c) => {
          const i = +v;
          [c.bookmarks[i - 1], c.bookmarks[i]] = [
            c.bookmarks[i],
            c.bookmarks[i - 1],
          ];
        })
      )
        bookmarks();
      break;
    case "undo":
      if (!history.length) {
        toast("No changes to undo");
        break;
      }
      try {
        save(history.at(-1));
        config = history.pop();
        refresh();
        editor();
        toast("Last change undone");
      } catch {
        toast("Could not save the undo in this browser");
      }
      break;
    case "baseline":
      modal(
        "Restore supplied baseline?",
        '<p class="body-copy">This resets your feature corrections, photo markers and bookmarks. You can undo this change during this session.</p><div class="row" style="margin-top:12px">' +
          btn("reset-confirm", "Restore baseline") +
          btn("editor", "Cancel") +
          "</div>",
      );
      break;
    case "reset-confirm":
      if (change((c) => Object.assign(c, empty()))) {
        editor();
        toast("Baseline restored");
      }
      break;
    case "export":
      exportFile();
      break;
    case "import":
      importFile();
      break;
  }
});
nav();
modeUI();
overview();
$("mode-menu").innerHTML = Object.entries(modes)
  .map(([id, [l, i]]) => btn("set-mode", l, i, id))
  .join("");
$("map-tools").innerHTML =
  tool("zoom", "Zoom in", "plus", "1.25") +
  tool("zoom", "Zoom out", "minus", ".8") +
  tool("fit", "Fit village", "fit") +
  tool("present", "Toggle presentation mode", "monitor") +
  tool("full", "Fullscreen", "full");
$("stages").innerHTML = stages.filter(s=>s.available)
  .map(
    (s) =>
      '<button class="stage ' +
      (s.id === activeStage ? "current" : "") +
      '" aria-pressed="' + (s.id === activeStage) + '" data-action="stage" data-value="' +
      s.id +
      '" title="' +
      (s.available ? s.title : "Not built yet") +
      '"><span class="stage-num">' +
      icon(s.available ? "layers" : "lock", 14) +
      "</span><span><small>STAGE " +
      s.id +
      "</small><strong>" +
      s.title +
      "</strong></span></button>",
  )
  .join("");
$("stages").addEventListener("wheel",event=>{
  const timeline=$("stages");
  if(timeline.scrollWidth<=timeline.clientWidth || Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?timeline.clientWidth:1);
  timeline.scrollLeft+=delta;
  event.preventDefault();
},{passive:false});
if (matchMedia("(max-width:720px)").matches)
  document.querySelector(".workspace").classList.add("collapsed");
try {
  scene = createScene($("scene"), {
    onSelect: (f) => inspect(f),
    onCamera: (c) => {
      lastCamera = c;
      $("compass").querySelector("svg").style.transform =
        "rotate(" + -c.heading + "deg)";
      drawPins();
    },
    onError: (message) => {
      $("load").hidden = false;
      $("load").textContent = String(message);
    },
  });
  if (scene) {
    scene.setFeatures(data);
    scene.setQuality(quality);
    $("load").hidden = true;
    drawPins();
  }
} catch (e) {
  $("load").hidden = false;
  $("load").textContent = "The 3D view could not start. " + (e?.message || String(e));
  const retry=document.createElement("button");
  retry.textContent="Reload 3D view";
  retry.dataset.action="reload-3d";
  $("load").append(document.createElement("br"),retry);
  console.error(e);
}
tankIoT=createTankIoT($("scene").parentNode,(...values)=>scene?.setTankIoT(...values),toast);
if(scene){
  guide=createGuidedTour({scene,system:tankIoT,stage:showStage,prepare(){
    endTour();tankIoT.close();setMode("orbit");
    document.querySelector(".workspace").classList.add("collapsed");
    $("map-controls").hidden=true;$("toggle-map-tools").setAttribute("aria-expanded","false");
    for(const name of ["buildings","water","roads","vegetation"])scene.setLayer(name,layers[name][1]=true);
  }});
  const query=new URLSearchParams(location.search);
  if(query.get("stage")==="3")$("stages").querySelector('[data-value="3"]').click();
  else if(query.get("tour")==="1")$("start-guide").click();
}else $("start-guide").disabled=true;
if (storageWarning) toast(storageWarning);
