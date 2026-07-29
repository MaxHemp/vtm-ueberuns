/**
 * VTM — Signalachse
 * ---------------------------------------------------------------------------
 * Ersetzt das frühere Knotennetz im Kopfbereich. Das lag quer über dem Text und
 * löste sich erst auf, wenn der Kopfbereich schon weggescrollt war.
 *
 * Diese Szene lebt fest in der rechten Randspalte und begleitet die ganze
 * Seite: eine senkrechte Achse in perspektivischer Tiefe, die sich beim
 * Scrollen fortzeichnet. Auf ihr sitzen die sechs Abschnitte als Knoten; der
 * gerade gelesene wächst und wechselt auf Messing. Ein paar Trabanten treiben
 * langsam mit.
 *
 * Sie berührt die Textspalte nicht, weil sie geometrisch dort gar nicht
 * hinreicht und zusätzlich per CSS-Maske nach links ausblendet.
 *
 * Steuerung durch den Aufrufer:
 *   setProgress(0..1)   Lesefortschritt der Seite
 *   setActive(index)    Index des aktiven Abschnitts, -1 für keinen
 *   setPointer(x, y)    normalisiert -1..1
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

const COBALT = new Color('#121e39');
const BLUE = new Color('#2468e8');
const BLUE_DEEP = new Color('#123fa6');
const BRASS = new Color('#c99b32');

const SEGMENTS = 320;   // Auflösung der Achse
const SECTIONS = 6;     // Mission, Team, Reichweite, Partner, Grundsätze, Kontakt
const MOTES = 120;      // Trabanten

function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Verlauf der Achse: leichtes Mäandern in x und z, streng monoton in y. */
function axisAt(t, height) {
  const y = (0.5 - t) * height;
  const x = Math.sin(t * 5.1) * 0.42 + Math.sin(t * 12.7) * 0.13;
  const z = Math.cos(t * 3.6) * 0.9 - 0.4;
  return [x, y, z];
}

const axisVert = /* glsl */ `
  attribute float aT;
  varying float vT;
  varying float vDepth;
  void main() {
    vT = aT;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = clamp((mv.z + 9.0) / 9.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const axisFrag = /* glsl */ `
  precision highp float;
  uniform float uProgress;
  uniform float uDark;
  uniform vec3 uDrawn;
  uniform vec3 uAhead;
  uniform vec3 uDrawnDark;
  uniform vec3 uAheadDark;
  varying float vT;
  varying float vDepth;

  void main() {
    // Bereits gelesener Teil kräftig, kommender Teil nur angedeutet.
    float drawn = step(vT, uProgress);
    // Laufender Kopf direkt an der Leseposition
    float head = smoothstep(0.045, 0.0, abs(vT - uProgress));

    vec3 col = mix(mix(uAhead, uAheadDark, uDark), mix(uDrawn, uDrawnDark, uDark), drawn);
    float alpha = (mix(0.20, 0.70, drawn) + head * 0.85) * mix(1.0, 1.25, uDark);
    alpha *= mix(0.55, 1.0, vDepth);
    gl_FragColor = vec4(col, alpha);
  }
`;

const nodeVert = /* glsl */ `
  attribute float aT;
  attribute float aIndex;
  uniform float uProgress;
  uniform float uActive;
  uniform float uScale;
  uniform float uDark;
  uniform vec3 uIdle;
  uniform vec3 uPassed;
  uniform vec3 uBrass;
  uniform vec3 uIdleDark;
  uniform vec3 uPassedDark;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRing;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    float active = 1.0 - clamp(abs(aIndex - uActive), 0.0, 1.0);
    float passed = step(aT, uProgress);

    vRing = active;
    gl_PointSize = uScale * (mix(1.0, 2.15, active)) * (300.0 / -mv.z);

    vColor = mix(mix(uIdle, uIdleDark, uDark), mix(uPassed, uPassedDark, uDark), passed);
    vColor = mix(vColor, uBrass, active);
    vAlpha = mix(0.46, 0.85, passed) + active * 0.15;
  }
`;

const nodeFrag = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRing;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.34, 0.10, d);
    // Der aktive Knoten bekommt zusätzlich einen dünnen Ring.
    float ring = smoothstep(0.50, 0.44, d) * smoothstep(0.36, 0.42, d) * vRing;
    float a = core * vAlpha + ring * 0.75;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const moteVert = /* glsl */ `
  attribute float aSeed;
  attribute float aT;
  uniform float uTime;
  uniform float uProgress;
  uniform float uScale;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.18 + aSeed * 6.28) * 0.55;
    p.x += cos(uTime * 0.13 + aSeed * 4.7) * 0.30;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = clamp((mv.z + 9.0) / 9.0, 0.0, 1.0);
    gl_PointSize = uScale * mix(0.5, 1.0, depth) * (300.0 / -mv.z);

    // Nur in der Nähe der Leseposition sichtbar: der Blick wandert mit.
    float near = smoothstep(0.30, 0.02, abs(aT - uProgress));
    vAlpha = (0.10 + near * 0.58) * mix(0.45, 1.0, depth);
  }
`;

const moteFrag = /* glsl */ `
  precision highp float;
  uniform float uDark;
  uniform vec3 uColor;
  uniform vec3 uColorDark;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float m = smoothstep(0.5, 0.15, d);
    if (m * vAlpha < 0.006) discard;
    gl_FragColor = vec4(mix(uColor, uColorDark, uDark), m * vAlpha);
  }
`;

export function createAxisScene(canvas, options) {
  const opts = options || {};
  const quality = opts.quality || 'high';
  const rand = mulberry(20260729);
  const HEIGHT = 6.7; // entspricht der sichtbaren Welthöhe bei z=9.2, fov=40

  // --- Achse ---------------------------------------------------------------
  const STRANDS = 3;
  const linePts = new Float32Array(SEGMENTS * STRANDS * 2 * 3);
  const lineT = new Float32Array(SEGMENTS * STRANDS * 2);
  let li = 0;
  for (let sIdx = 0; sIdx < STRANDS; sIdx++) {
    const phase = sIdx * 2.09;      // 120 Grad versetzt
    const amp = sIdx === 1 ? 0.0 : 0.085;
    for (let i = 0; i < SEGMENTS; i++) {
      const t0 = i / SEGMENTS;
      const t1 = (i + 1) / SEGMENTS;
      const a = axisAt(t0, HEIGHT);
      const b = axisAt(t1, HEIGHT);
      // Die aeusseren Straenge winden sich langsam um den mittleren.
      a[0] += Math.cos(t0 * 26 + phase) * amp;
      a[2] += Math.sin(t0 * 26 + phase) * amp;
      b[0] += Math.cos(t1 * 26 + phase) * amp;
      b[2] += Math.sin(t1 * 26 + phase) * amp;
      linePts.set(a, li * 6);
      linePts.set(b, li * 6 + 3);
      lineT[li * 2] = t0;
      lineT[li * 2 + 1] = t1;
      li++;
    }
  }
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(linePts, 3));
  lineGeo.setAttribute('aT', new BufferAttribute(lineT, 1));

  const axisUniforms = {
    uProgress: { value: 0 },
    uDark: { value: 0 },
    uDrawn: { value: BLUE_DEEP },
    uAhead: { value: COBALT },
    uDrawnDark: { value: BRASS },
    uAheadDark: { value: new Color('#8fa6d8') },
  };
  const axis = new LineSegments(
    lineGeo,
    new ShaderMaterial({
      uniforms: axisUniforms,
      vertexShader: axisVert,
      fragmentShader: axisFrag,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
  );

  // --- Abschnittsknoten ----------------------------------------------------
  const nodePos = new Float32Array(SECTIONS * 3);
  const nodeT = new Float32Array(SECTIONS);
  const nodeIdx = new Float32Array(SECTIONS);
  for (let i = 0; i < SECTIONS; i++) {
    const t = 0.10 + (i / (SECTIONS - 1)) * 0.80;
    nodePos.set(axisAt(t, HEIGHT), i * 3);
    nodeT[i] = t;
    nodeIdx[i] = i;
  }
  const nodeGeo = new BufferGeometry();
  nodeGeo.setAttribute('position', new BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('aT', new BufferAttribute(nodeT, 1));
  nodeGeo.setAttribute('aIndex', new BufferAttribute(nodeIdx, 1));

  const nodeUniforms = {
    uProgress: { value: 0 },
    uActive: { value: -1 },
    uScale: { value: quality === 'low' ? 0.22 : 0.28 },
    uIdle: { value: COBALT },
    uPassed: { value: BLUE },
    uBrass: { value: BRASS },
    uDark: { value: 0 },
    uIdleDark: { value: new Color('#7f97cc') },
    uPassedDark: { value: new Color('#cfe0ff') },
  };
  const nodes = new Points(
    nodeGeo,
    new ShaderMaterial({
      uniforms: nodeUniforms,
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
  );

  // --- Trabanten -----------------------------------------------------------
  const motePos = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  const moteT = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    const t = rand();
    const base = axisAt(t, HEIGHT);
    motePos[i * 3] = base[0] + (rand() - 0.5) * 2.6;
    motePos[i * 3 + 1] = base[1] + (rand() - 0.5) * 0.9;
    motePos[i * 3 + 2] = base[2] + (rand() - 0.5) * 2.2;
    moteSeed[i] = rand();
    moteT[i] = t;
  }
  const moteGeo = new BufferGeometry();
  moteGeo.setAttribute('position', new BufferAttribute(motePos, 3));
  moteGeo.setAttribute('aSeed', new BufferAttribute(moteSeed, 1));
  moteGeo.setAttribute('aT', new BufferAttribute(moteT, 1));

  const moteUniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uScale: { value: quality === 'low' ? 0.075 : 0.095 },
    uDark: { value: 0 },
    uColor: { value: BLUE_DEEP },
    uColorDark: { value: new Color('#a8bfe8') },
  };
  const motes = new Points(
    moteGeo,
    new ShaderMaterial({
      uniforms: moteUniforms,
      vertexShader: moteVert,
      fragmentShader: moteFrag,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
  );

  const scene = new Scene();
  scene.add(axis);
  scene.add(motes);
  scene.add(nodes);

  const camera = new PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 9.2);

  const renderer = new WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: quality === 'high',
    powerPreference: 'low-power',
  });
  renderer.setClearAlpha(0);

  const t0 = performance.now();
  let last = t0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = null;
  let running = false;
  let disposed = false;
  let progressTarget = 0;
  let progressCurrent = 0;
  let activeTarget = -1;
  let activeCurrent = -1;
  let darkTarget = 0;
  let darkCurrent = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1.4 : 1.9));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Die Achse steht im Weltursprung. Damit sie am rechten Rand sitzt, wird
    // die Kamera nach links versetzt; wie weit, hängt von der Canvasbreite ab.
    camera.position.x = -0.62;
    camera.position.z = 9.2;
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const t = (now - t0) / 1000;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const step = function (k) { return 1 - Math.pow(1 - k, dt * 60); };

    pointer.x += (pointer.tx - pointer.x) * step(0.05);
    pointer.y += (pointer.ty - pointer.y) * step(0.05);
    progressCurrent += (progressTarget - progressCurrent) * step(0.14);
    if (activeTarget < 0) activeCurrent = -1;
    else if (activeCurrent < 0) activeCurrent = activeTarget;
    else activeCurrent += (activeTarget - activeCurrent) * step(0.16);

    darkCurrent += (darkTarget - darkCurrent) * step(0.09);
    axisUniforms.uDark.value = darkCurrent;
    nodeUniforms.uDark.value = darkCurrent;
    moteUniforms.uDark.value = darkCurrent;
    axisUniforms.uProgress.value = progressCurrent;
    nodeUniforms.uProgress.value = progressCurrent;
    nodeUniforms.uActive.value = activeCurrent;
    moteUniforms.uProgress.value = progressCurrent;
    moteUniforms.uTime.value = t;

    // Sehr zurückhaltende Eigenbewegung plus Zeigerparallaxe.
    scene.rotation.y = 0.18 + pointer.x * 0.12 + Math.sin(t * 0.06) * 0.03;
    scene.rotation.z = pointer.y * 0.02;

    renderer.render(scene, camera);
  }

  function start() {
    if (running || disposed) return;
    running = true;
    last = performance.now();
    frame();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  resize();

  return {
    start: start,
    stop: stop,
    resize: resize,
    setProgress: function (v, immediate) {
      progressTarget = Math.min(1, Math.max(0, v));
      if (immediate) progressCurrent = progressTarget;
    },
    setDark: function (on) {
      darkTarget = on ? 1 : 0;
    },
    setActive: function (i) {
      activeTarget = typeof i === 'number' ? i : -1;
    },
    setPointer: function (x, y) {
      pointer.tx = x;
      pointer.ty = y;
    },
    dispose: function () {
      disposed = true;
      stop();
      lineGeo.dispose();
      nodeGeo.dispose();
      moteGeo.dispose();
      axis.material.dispose();
      nodes.material.dispose();
      motes.material.dispose();
      renderer.dispose();
    },
  };
}
