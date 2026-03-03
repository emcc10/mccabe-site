/* ============================================================
   MRP - FULL JS (INLINE-SAFE) - FINAL BASELINE
   - Creates overlay + FORCES visible yellow dots (diagnostic)
   - Draws connector dots for pieces (real)
   - Snaps left↔right unless ARM-TO-ARM (includes wedge/wide)
   - Volusion-proof image sizing (no distortion)
   ============================================================ */

window.MRP_CONFIG = window.MRP_CONFIG || { series: "41952 ELITE", variant: "power" };

const MRP_IMG_BASE = "/v/vspfiles/MRP/";
const HTS_IMAGE_MAP = {
  "1L":"1L.png","2L":"2L.png","3L":"3L.png","4L":"4L.png","5L":"5L.png","6L":"6L.png","7L":"7L.png","8L":"8L.png","9L":"9L.png"
};

/* Optional PNG padding normalization per SKU */
const HTS_ART_TWEAK = {
  // "1L": { scale: 1.08, offsetX: 0, offsetY: 0 },
  // "7L": { scale: 1.05, offsetX: 0, offsetY: 0 },
};

/* ============================================================
   HTS_DATA (EXAMPLE)
   IMPORTANT:
   - armLeft / armRight are REQUIRED for "no arm-to-arm snap" rule.
   - wedge/wide arm counts as an arm on that side.
   - connectors: side must be "left"/"right"
   ============================================================ */
const HTS_DATA = {
  "41952 ELITE": {
    power: [
      { sku:"1L", name:"Armless", width:24, depth:40, armLeft:false, armRight:false, wedge:false,
        connectors:[
          { id:"rowL", group:"row", side:"left",  xPct:0.00, yPct:0.52, angleDeg:180 },
          { id:"rowR", group:"row", side:"right", xPct:1.00, yPct:0.52, angleDeg:0 }
        ]
      },
      { sku:"2L", name:"LHF Recliner", width:36, depth:40, armLeft:true, armRight:false, wedge:false,
        connectors:[ { id:"rowR", group:"row", side:"right", xPct:1.00, yPct:0.52, angleDeg:0 } ]
      },
      { sku:"3L", name:"RHF Recliner", width:36, depth:40, armLeft:false, armRight:true, wedge:false,
        connectors:[ { id:"rowL", group:"row", side:"left", xPct:0.00, yPct:0.52, angleDeg:180 } ]
      },

      // Two-arm combos (block connections on both sides because both sides have arms)
      { sku:"5L", name:"LHF Recliner + RHF Wide Arm (Wedge Right)", width:44, depth:40,
        armLeft:true, armRight:true, wedge:true, wedgeSide:"right", wedgeAngle:7.5,
        connectors:[ { id:"rowL", group:"row", side:"left", xPct:0.00, yPct:0.52, angleDeg:180 } ]
      },
      { sku:"6L", name:"RHF Recliner + LHF Wide Arm (Wedge Left)", width:44, depth:40,
        armLeft:true, armRight:true, wedge:true, wedgeSide:"left", wedgeAngle:7.5,
        connectors:[ { id:"rowR", group:"row", side:"right", xPct:1.00, yPct:0.52, angleDeg:0 } ]
      },

      // Single wide arm (wedge)
      { sku:"7L", name:"RHF Wide Arm Recliner (Wedge Right)", width:38, depth:40,
        armLeft:false, armRight:true, wedge:true, wedgeSide:"right", wedgeAngle:7.5,
        connectors:[ { id:"rowL", group:"row", side:"left", xPct:0.00, yPct:0.52, angleDeg:180 } ]
      },
      { sku:"9L", name:"LHF Wide Arm Recliner (Wedge Left)", width:38, depth:40,
        armLeft:true, armRight:false, wedge:true, wedgeSide:"left", wedgeAngle:7.5,
        connectors:[ { id:"rowR", group:"row", side:"right", xPct:1.00, yPct:0.52, angleDeg:0 } ]
      }
    ],
    manual: []
  }
};

/* ============================================================
   STATE
   ============================================================ */
const MRP = {
  els: { root:null, toolbar:null, room:null, tray:null, overlay:null },
  config: { series: window.MRP_CONFIG.series, variant: window.MRP_CONFIG.variant },
  scale: { ppi: 6, gridPx: 6 },
  room: { widthIn: 180, depthIn: 120 },
  pieces: [],
  activeId: null,
  drag: { isDown:false, pointerId:null, startX:0, startY:0, pieceStartX:0, pieceStartY:0 }
};

let __z = 10;
const nextZ = () => (++__z);

/* ============================================================
   INIT
   ============================================================ */
(function initMRP(){
  MRP.els.root = document.getElementById("mrp-root");
  MRP.els.toolbar = document.getElementById("mrp-toolbar");
  MRP.els.room = document.getElementById("mrp-room");
  MRP.els.tray = document.getElementById("mrp-tray");

  console.log("[MRP] init:", {
    root: !!MRP.els.root,
    toolbar: !!MRP.els.toolbar,
    room: !!MRP.els.room,
    tray: !!MRP.els.tray
  });

  if (!MRP.els.root || !MRP.els.toolbar || !MRP.els.room || !MRP.els.tray) {
    console.warn("[MRP] Missing required IDs: mrp-root, mrp-toolbar, mrp-room, mrp-tray");
    return;
  }

  injectHardeningCSS();
  ensureOverlay();

  // Force test dots so you can’t claim you “don’t see circles”
  forceTestDots();

  renderToolbar();
  renderTray();
  updateRoom();

  MRP.els.room.addEventListener("pointerdown", (e) => {
    if (e.target === MRP.els.room || e.target === MRP.els.overlay) setActive(null);
  });

  // redraw dots again after layout stabilizes
  setTimeout(() => {
    ensureOverlay();
    forceTestDots();
    renderConnectorOverlay();
  }, 350);
})();

/* ============================================================
   CATALOG/TRAY
   ============================================================ */
function getCatalog(){
  const s = MRP.config.series;
  const v = MRP.config.variant;
  return (HTS_DATA[s] && HTS_DATA[s][v]) ? HTS_DATA[s][v] : [];
}

function renderTray(){
  const items = getCatalog();
  MRP.els.tray.innerHTML = "";

  if (!items.length) {
    MRP.els.tray.innerHTML = `<div class="mrp-empty">No pieces for ${esc(MRP.config.series)} (${esc(MRP.config.variant)})</div>`;
    return;
  }

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mrp-tray-item";

    const url = MRP_IMG_BASE + (HTS_IMAGE_MAP[item.sku] || "");
    btn.innerHTML = `
      <span class="mrp-thumb"><img class="mrp-thumb-img" src="${url}" alt=""></span>
      <span class="mrp-tray-meta">
        <span class="mrp-tray-name">${esc(item.name)}</span>
        <span class="mrp-tray-dims">${item.width}" W × ${item.depth}" D</span>
      </span>
    `;
    btn.addEventListener("click", () => addPiece(item, { xPx: 24, yPx: 24 }));
    MRP.els.tray.appendChild(btn);
  });
}

/* ============================================================
   TOOLBAR
   ============================================================ */
function renderToolbar(){
  MRP.els.toolbar.innerHTML = `
    <div class="mrp-tools">
      <button type="button" class="mrp-btn" id="mrp-rot-left">⟲ -1°</button>
      <button type="button" class="mrp-btn" id="mrp-rot-right">⟳ +1°</button>
      <button type="button" class="mrp-btn" id="mrp-rot-90">↻ 90°</button>
      <button type="button" class="mrp-btn" id="mrp-rot-reset">Reset</button>
      <button type="button" class="mrp-btn" id="mrp-wedge-step">Wedge Step</button>
      <button type="button" class="mrp-btn danger" id="mrp-del">Delete</button>
      <button type="button" class="mrp-btn" id="mrp-redraw-dots">Redraw Dots</button>
    </div>
  `;
  const $ = (id) => document.getElementById(id);

  $("mrp-rot-left").onclick = () => rotateActive(-1);
  $("mrp-rot-right").onclick = () => rotateActive(+1);
  $("mrp-rot-90").onclick = () => rotateActive(90);
  $("mrp-rot-reset").onclick = () => setRotActive(0);
  $("mrp-wedge-step").onclick = () => wedgeStepActive();
  $("mrp-del").onclick = () => deleteActive();
  $("mrp-redraw-dots").onclick = () => { ensureOverlay(); forceTestDots(); renderConnectorOverlay(); };
}

/* ============================================================
   ROOM
   ============================================================ */
function updateRoom(){
  const wPx = Math.round(MRP.room.widthIn * MRP.scale.ppi);
  const hPx = Math.round(MRP.room.depthIn * MRP.scale.ppi);

  MRP.els.room.style.setProperty("width", wPx + "px", "important");
  MRP.els.room.style.setProperty("height", hPx + "px", "important");
  MRP.els.room.style.setProperty("position", "relative", "important");

  ensureOverlay();
  renderConnectorOverlay();
}

/* ============================================================
   OVERLAY + DOTS
   ============================================================ */
function ensureOverlay(){
  const room = MRP.els.room;
  room.style.setProperty("position", "relative", "important");

  let ov = room.querySelector(".mrp-overlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "mrp-overlay";
    room.appendChild(ov);
  }

  // Nuclear styling (beats theme nonsense)
  ov.style.setProperty("position","absolute","important");
  ov.style.setProperty("left","0","important");
  ov.style.setProperty("top","0","important");
  ov.style.setProperty("right","0","important");
  ov.style.setProperty("bottom","0","important");
  ov.style.setProperty("pointer-events","none","important");
  ov.style.setProperty("z-index","2147483647","important");

  MRP.els.overlay = ov;
}

function drawDot(x, y){
  const d = document.createElement("div");
  d.className = "mrp-connector-dot";
  d.style.setProperty("position","absolute","important");
  d.style.setProperty("left", x + "px", "important");
  d.style.setProperty("top",  y + "px", "important");
  d.style.setProperty("width","20px","important");
  d.style.setProperty("height","20px","important");
  d.style.setProperty("border-radius","999px","important");
  d.style.setProperty("background","#ffd400","important");
  d.style.setProperty("border","3px solid rgba(0,0,0,.45)","important");
  d.style.setProperty("box-shadow","0 2px 6px rgba(0,0,0,.35)","important");
  d.style.setProperty("transform","translate(-50%,-50%)","important");
  return d;
}

/* Draws test dots so you can confirm overlay is visible */
function forceTestDots(){
  ensureOverlay();
  const ov = MRP.els.overlay;
  ov.innerHTML = "";

  const pts = [[40,40],[120,40],[200,40],[40,120],[120,120],[200,120]];
  pts.forEach(([x,y]) => ov.appendChild(drawDot(x,y)));

  console.log("[MRP] test dots drawn:", pts.length);
}

/* Draws real connector dots for pieces (appends after test dots) */
function renderConnectorOverlay(){
  ensureOverlay();
  const ov = MRP.els.overlay;

  // Keep the test dots if no pieces yet
  if (!MRP.pieces.length) return;

  // Remove test dots and draw only real ones once pieces exist
  ov.innerHTML = "";

  for (const p of MRP.pieces) {
    if (!p.connectors?.length) continue;
    const cons = worldConnectors(p);
    for (const c of cons) {
      ov.appendChild(drawDot(c.wx, c.wy));
    }
  }
}

/* ============================================================
   PIECES
   ============================================================ */
function addPiece(item, { xPx, yPx }){
  const id = "p_" + Math.random().toString(36).slice(2, 10);
  const wPx = in2px(item.width);
  const hPx = in2px(item.depth);

  const el = document.createElement("div");
  el.className = "mrp-piece";
  el.tabIndex = 0;
  el.dataset.pid = id;

  el.style.setProperty("width", wPx + "px", "important");
  el.style.setProperty("height", hPx + "px", "important");
  el.style.setProperty("min-width", wPx + "px", "important");
  el.style.setProperty("min-height", hPx + "px", "important");
  el.style.setProperty("max-width", wPx + "px", "important");
  el.style.setProperty("max-height", hPx + "px", "important");
  el.style.setProperty("flex", "none", "important");
  el.style.setProperty("position", "absolute", "important");
  el.style.setProperty("isolation", "isolate", "important");

  const img = document.createElement("img");
  img.className = "mrp-piece-img";
  img.alt = item.name || item.sku;
  img.src = MRP_IMG_BASE + (HTS_IMAGE_MAP[item.sku] || "");

  // Volusion-proof image sizing
  img.style.setProperty("position", "absolute", "important");
  img.style.setProperty("inset", "0", "important");
  img.style.setProperty("width", "100%", "important");
  img.style.setProperty("height", "100%", "important");
  img.style.setProperty("object-fit", "contain", "important");
  img.style.setProperty("object-position", "center center", "important");
  img.style.setProperty("max-width", "none", "important");
  img.style.setProperty("max-height", "none", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("pointer-events", "none", "important");
  img.style.setProperty("transform-origin", "50% 50%", "important");

  const tweak = HTS_ART_TWEAK[item.sku];
  if (tweak && (tweak.scale || tweak.offsetX || tweak.offsetY)) {
    const s = (tweak.scale || 1);
    const ox = (tweak.offsetX || 0);
    const oy = (tweak.offsetY || 0);
    img.style.setProperty("transform", `translate(${ox}%, ${oy}%) scale(${s})`, "important");
  } else {
    img.style.setProperty("transform", "none", "important");
  }

  el.appendChild(img);

  const label = document.createElement("div");
  label.className = "mrp-piece-label";
  label.textContent = item.sku;
  el.appendChild(label);

  MRP.els.room.appendChild(el);

  const piece = {
    id, el,
    sku: item.sku,
    widthIn: item.width,
    depthIn: item.depth,
    connectors: Array.isArray(item.connectors) ? item.connectors : [],

    armLeft: !!item.armLeft,
    armRight: !!item.armRight,

    wedge: !!item.wedge,
    wedgeSide: item.wedgeSide || null,
    wedgeAngle: typeof item.wedgeAngle === "number" ? item.wedgeAngle : 7.5,

    xPx: xPx ?? 0,
    yPx: yPx ?? 0,
    rotDeg: 0,
    z: nextZ()
  };

  piece.el.style.zIndex = String(piece.z);

  wireSelection(piece);
  makeDraggable(piece);

  clampToRoom(piece);
  applyTransform(piece);

  MRP.pieces.push(piece);
  setActive(piece.id);

  renderConnectorOverlay();
  return piece;
}

function wireSelection(piece){
  piece.el.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    setActive(piece.id);
    bringFront(piece);
  });
}

function setActive(idOrNull){
  MRP.activeId = idOrNull;
  MRP.pieces.forEach(p => p.el.classList.toggle("active", p.id === idOrNull));
}

function activePiece(){
  return MRP.pieces.find(p => p.id === MRP.activeId) || null;
}

function deleteActive(){
  const p = activePiece();
  if (!p) return;
  p.el.remove();
  MRP.pieces = MRP.pieces.filter(x => x.id !== p.id);
  setActive(null);
  renderConnectorOverlay();
}

function rotateActive(deltaDeg){
  const p = activePiece();
  if (!p) return;
  p.rotDeg = norm(p.rotDeg + deltaDeg);
  applyTransform(p);
  renderConnectorOverlay();
}

function setRotActive(deg){
  const p = activePiece();
  if (!p) return;
  p.rotDeg = norm(deg);
  applyTransform(p);
  renderConnectorOverlay();
}

function wedgeStepActive(){
  const p = activePiece();
  if (!p) return;
  const step = p.wedge ? p.wedgeAngle : 7.5;
  const dir = (p.wedgeSide === "left") ? -1 : 1;
  p.rotDeg = norm(p.rotDeg + dir * step);
  applyTransform(p);
  renderConnectorOverlay();
}

function bringFront(piece){
  piece.z = nextZ();
  piece.el.style.zIndex = String(piece.z);
}

/* ============================================================
   DRAG + SNAP
   ============================================================ */
function makeDraggable(piece){
  const el = piece.el;

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    setActive(piece.id);
    bringFront(piece);

    MRP.drag.isDown = true;
    MRP.drag.pointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);

    const pt = roomPt(e);
    MRP.drag.startX = pt.x;
    MRP.drag.startY = pt.y;
    MRP.drag.pieceStartX = piece.xPx;
    MRP.drag.pieceStartY = piece.yPx;

    e.preventDefault();
  });

  el.addEventListener("pointermove", (e) => {
    if (!MRP.drag.isDown || MRP.drag.pointerId !== e.pointerId) return;

    const pt = roomPt(e);
    const dx = pt.x - MRP.drag.startX;
    const dy = pt.y - MRP.drag.startY;

    piece.xPx = snap(MRP.drag.pieceStartX + dx, MRP.scale.gridPx);
    piece.yPx = snap(MRP.drag.pieceStartY + dy, MRP.scale.gridPx);

    clampToRoom(piece);
    applyTransform(piece);

    const targetId = findBestTarget(piece);
    MRP.pieces.forEach(p => p.el.classList.toggle("mrp-snap-target", targetId && p.id === targetId));

    renderConnectorOverlay();
  });

  el.addEventListener("pointerup", (e) => {
    if (!MRP.drag.isDown || MRP.drag.pointerId !== e.pointerId) return;

    MRP.drag.isDown = false;
    MRP.drag.pointerId = null;

    trySnapAlign(piece);

    MRP.pieces.forEach(p => p.el.classList.remove("mrp-snap-target"));
    renderConnectorOverlay();
  });

  el.addEventListener("pointercancel", () => {
    MRP.drag.isDown = false;
    MRP.drag.pointerId = null;
    MRP.pieces.forEach(p => p.el.classList.remove("mrp-snap-target"));
    renderConnectorOverlay();
  });
}

/* ============================================================
   CONNECTOR MATH + SNAP RULE
   - left↔right only
   - block ARM-TO-ARM on connecting sides
   ============================================================ */
function worldConnectors(piece){
  const w = in2px(piece.widthIn);
  const h = in2px(piece.depthIn);
  const cx = piece.xPx + w / 2;
  const cy = piece.yPx + h / 2;
  const rad = deg2rad(piece.rotDeg);

  return (piece.connectors || []).map(c => {
    const lx = (c.xPct ?? 0) * w;
    const ly = (c.yPct ?? 0) * h;

    const relX = lx - w / 2;
    const relY = ly - h / 2;

    const rx = relX * Math.cos(rad) - relY * Math.sin(rad);
    const ry = relX * Math.sin(rad) + relY * Math.cos(rad);

    return {
      ...c,
      wx: cx + rx,
      wy: cy + ry,
      worldAngle: norm(piece.rotDeg + (c.angleDeg || 0))
    };
  });
}

function isValidMate(activePiece, otherPiece, aConn, bConn){
  if (!aConn.group || !bConn.group) return false;
  if (aConn.group !== bConn.group) return false;

  if (!aConn.side || !bConn.side) return false;
  const opposite = (aConn.side === "left" && bConn.side === "right") ||
                   (aConn.side === "right" && bConn.side === "left");
  if (!opposite) return false;

  const aHasArm = (aConn.side === "left") ? !!activePiece.armLeft : !!activePiece.armRight;
  const bHasArm = (bConn.side === "left") ? !!otherPiece.armLeft  : !!otherPiece.armRight;

  // your rule: do NOT snap if two arms/wedges are trying to connect
  if (aHasArm && bHasArm) return false;

  return true;
}

function findBestTarget(active){
  if (!active.connectors?.length) return null;

  const SNAP_DIST = 30;
  const A = worldConnectors(active);
  let best = null;

  for (const other of MRP.pieces) {
    if (other.id === active.id) continue;
    if (!other.connectors?.length) continue;

    const B = worldConnectors(other);

    for (const a of A) {
      for (const b of B) {
        if (!isValidMate(active, other, a, b)) continue;

        const dist = Math.hypot(b.wx - a.wx, b.wy - a.wy);
        if (dist <= SNAP_DIST && (!best || dist < best.dist)) best = { id: other.id, dist };
      }
    }
  }
  return best ? best.id : null;
}

function trySnapAlign(active){
  if (!active.connectors?.length) return false;

  const SNAP_DIST = 30;
  const MAX_ROTATE = 10;
  const A0 = worldConnectors(active);
  let best = null;

  for (const other of MRP.pieces) {
    if (other.id === active.id) continue;
    if (!other.connectors?.length) continue;

    const B = worldConnectors(other);

    for (const a of A0) {
      for (const b of B) {
        if (!isValidMate(active, other, a, b)) continue;

        const dist = Math.hypot(b.wx - a.wx, b.wy - a.wy);
        if (dist > SNAP_DIST) continue;

        const targetAngle = norm(b.worldAngle + 180);
        const delta = shortestDelta(a.worldAngle, targetAngle);
        const clamped = Math.abs(delta) > MAX_ROTATE ? Math.sign(delta) * MAX_ROTATE : delta;

        const score = dist + Math.abs(delta) * 0.7;
        if (!best || score < best.score) best = { aId: a.id, b, delta: clamped, score };
      }
    }
  }

  if (!best) return false;

  active.rotDeg = norm(active.rotDeg + best.delta);
  applyTransform(active);

  const A1 = worldConnectors(active);
  const a1 = A1.find(x => x.id === best.aId);
  if (!a1) return false;

  active.xPx += (best.b.wx - a1.wx);
  active.yPx += (best.b.wy - a1.wy);

  clampToRoom(active);
  applyTransform(active);
  return true;
}

/* ============================================================
   TRANSFORM + BOUNDS
   ============================================================ */
function applyTransform(p){
  p.el.style.setProperty("transform-origin", "center center", "important");
  p.el.style.setProperty("transform", `translate(${p.xPx}px, ${p.yPx}px) rotate(${p.rotDeg}deg)`, "important");
}

function clampToRoom(p){
  const r = MRP.els.room.getBoundingClientRect();
  const w = in2px(p.widthIn);
  const h = in2px(p.depthIn);
  p.xPx = clamp(p.xPx, 0, Math.max(0, r.width - w));
  p.yPx = clamp(p.yPx, 0, Math.max(0, r.height - h));
}

/* ============================================================
   CSS HARDENING INJECT
   ============================================================ */
function injectHardeningCSS(){
  const id = "mrp-hardening-css";
  if (document.getElementById(id)) return;

  const css = `
    #mrp-root, #mrp-root *{ box-sizing:border-box !important; }
    #mrp-root{ position:relative !important; transform:none !important; zoom:1 !important; filter:none !important; }
    #mrp-root #mrp-room{ position:relative !important; display:block !important; flex:none !important; overflow:hidden !important; transform:none !important; filter:none !important; }
    #mrp-root img{ max-width:none !important; height:auto !important; }
  `;

  const s = document.createElement("style");
  s.id = id;
  s.type = "text/css";
  s.appendChild(document.createTextNode(css));
  document.head.appendChild(s);
}

/* ============================================================
   UTIL
   ============================================================ */
function in2px(n){ return Math.round(n * MRP.scale.ppi); }
function snap(v,g){ return Math.round(v/g)*g; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function norm(d){ let x = d % 360; if (x > 180) x -= 360; if (x < -180) x += 360; return x; }
function deg2rad(d){ return d * Math.PI / 180; }
function shortestDelta(from,to){ let d = norm(to - from); if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
function roomPt(e){ const r = MRP.els.room.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function esc(s){ return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }