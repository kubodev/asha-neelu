// Keep north fixed while the first-person camera moves and turns.
export function createInset(parent, extent) {
  const inset = document.createElement("canvas"),
    base = document.createElement("canvas");
  inset.width = base.width = 240;
  inset.height = base.height = 182;
  inset.style.cssText =
    "position:absolute;bottom:45px;left:14px;width:106px;height:80px;border:2px solid #f7faf2;border-radius:6px;box-shadow:0 1px 6px #243c2c55;pointer-events:none;display:none;";
  inset.setAttribute("role", "img");
  const ctx = inset.getContext("2d"),
    bg = base.getContext("2d");
  let factor = 1,
    items = [];
  const xy = (x, z) => [120 + x * factor, 91 + z * factor];
  function paint() {
    bg.fillStyle = "#d8dcd0";
    bg.fillRect(0, 0, 240, 182);
    const [l, t] = xy(-extent.width / 2, -extent.depth / 2);
    bg.fillStyle = "#d1cbb6";
    bg.fillRect(l, t, extent.width * factor, extent.depth * factor);
    for (const f of items) {
      if (
        !["water", "river", "pipe", "building", "land", "road"].includes(f.kind) ||
        !f.points.length
      )
        continue;
      bg.beginPath();
      f.points.forEach((p, i) => {
        const v = xy(...p);
        if (i) bg.lineTo(...v);
        else bg.moveTo(...v);
      });
      if (f.kind === "road" || f.kind === "pipe") {
        bg.strokeStyle = "#f7f3df";
        bg.lineWidth = Math.max(1, (f.width || 6) * factor);
        bg.stroke();
      } else {
        bg.closePath();
        bg.fillStyle =
          ["water", "river"].includes(f.kind)
            ? "#597677"
            : f.kind === "building"
              ? "#999483"
              : f.color || "#b7b498";
        bg.fill();
      }
    }
  }
  function setFeatures(features) {
    items = features
      .filter((f) => f.kind === "land")
      .concat(features.filter((f) => f.kind !== "land"));
    paint();
  }
  function draw(c) {
    const active = c.mode === "walk" || c.mode === "fly";
    inset.style.display = active ? "block" : "none";
    if (!active) return;
    const scale =
      Math.min(232 / extent.width, 174 / extent.depth) /
      (c.mode === "fly" ? 1.67 : 1);
    if (scale !== factor) {
      factor = scale;
      paint();
    }
    ctx.drawImage(base, 0, 0);
    const [x, y] = xy(c.x, c.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(c.yaw);
    ctx.fillStyle = "#284f3680";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 22, -2.05, -1.09);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#244f3b";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#f9fbf4";
    ctx.fillRect(4, 4, 24, 25);
    ctx.font = "bold 19px sans-serif";
    ctx.fillStyle = "#35513b";
    ctx.fillText("N", 9, 23);
    inset.setAttribute(
      "aria-label",
      "Orientation map. Camera heading " + Math.round(c.heading) + " degrees.",
    );
  }
  parent.append(inset);
  return { setFeatures, draw, destroy: () => inset.remove() };
}
