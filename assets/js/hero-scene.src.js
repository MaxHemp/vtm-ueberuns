/**
 * VTM Hero-Szene: "Signal im Rauschen"
 * ---------------------------------------------------------------------------
 * Leitmotiv des Magazins als 3D-Objekt. Ein Knotennetz steht beim Laden als
 * Rauschen im Raum; sobald gescrollt wird, wandern die Knoten auf konzentrische
 * Ringe und die Verbindungen werden kurz genug, um sichtbar zu werden.
 * Aus Rauschen wird Signal. Genau das behauptet die Seite im Text, hier tut sie es.
 *
 * Beide Zustände liegen als Attribute im Buffer, der Vertex-Shader mischt sie
 * über eine Uniform. Es gibt also keine Nachbarschaftssuche pro Frame und keine
 * Geometrie-Updates auf der CPU: der Rechenaufwand pro Bild ist eine Handvoll
 * Uniform-Writes.
 *
 * Aufrufer steuert:
 *   scene.setOrder(0..1)   Rauschen -> Ordnung (von ScrollTrigger gescrubbt)
 *   scene.setPointer(x, y) normalisiert -1..1
 *   scene.dispose()
 */
import {
  AdditiveBlending,
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

// --- Markenfarben (VTM DS 4.2) ---------------------------------------------
const COBALT = new Color('#121e39');
const BLUE = new Color('#2468e8');
const BRASS = new Color('#c99b32');
const LINE = new Color('#123fa6');

const RING_COUNT = 7;
const PER_RING = 84;
const NODE_COUNT = RING_COUNT * PER_RING; // 588

// Deterministischer PRNG: die Szene sieht bei jedem Laden gleich aus.
function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vertexShader = /* glsl */ `
  attribute vec3 aNoise;
  attribute vec3 aOrder;
  attribute float aSeed;
  attribute float aAccent;

  uniform float uTime;
  uniform float uOrder;
  uniform float uSize;
  uniform vec3 uCobalt;
  uniform vec3 uBlue;
  uniform vec3 uBrass;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Rauschen driftet frei, die Ordnung atmet nur leicht.
    vec3 drift = vec3(
      sin(uTime * 0.21 + aSeed * 6.28) * 0.42,
      cos(uTime * 0.17 + aSeed * 4.19) * 0.38,
      sin(uTime * 0.13 + aSeed * 5.11) * 0.30
    );
    vec3 breathe = vec3(
      sin(uTime * 0.34 + aSeed * 6.28) * 0.055,
      cos(uTime * 0.29 + aSeed * 3.71) * 0.055,
      0.0
    );

    float e = uOrder * uOrder * (3.0 - 2.0 * uOrder); // smoothstep
    vec3 pos = mix(aNoise + drift, aOrder + breathe, e);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Tiefe steuert Größe und Deckkraft: hinten kleiner und blasser.
    float depth = clamp((mv.z + 16.0) / 16.0, 0.0, 1.0);
    gl_PointSize = uSize * mix(0.55, 1.0, depth) * (300.0 / -mv.z);

    vColor = mix(uCobalt, uBlue, depth);
    vColor = mix(vColor, uBrass, aAccent);
    vAlpha = (mix(0.38, 0.95, depth) + aAccent * 0.05) * mix(0.70, 1.0, e);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Weiche runde Punkte statt harter Quadrate.
    float d = length(gl_PointCoord - vec2(0.5));
    float mask = smoothstep(0.5, 0.16, d);
    if (mask < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * mask);
  }
`;

const lineVertexShader = /* glsl */ `
  attribute vec3 aNoise;
  attribute vec3 aOrder;
  attribute vec3 aMateNoise;
  attribute vec3 aMateOrder;
  attribute float aSeed;
  attribute float aMateSeed;

  uniform float uTime;
  uniform float uOrder;

  varying float vLen;

  vec3 driftOf(float seed) {
    return vec3(
      sin(uTime * 0.21 + seed * 6.28) * 0.42,
      cos(uTime * 0.17 + seed * 4.19) * 0.38,
      sin(uTime * 0.13 + seed * 5.11) * 0.30
    );
  }

  void main() {
    float e = uOrder * uOrder * (3.0 - 2.0 * uOrder);
    vec3 pos  = mix(aNoise + driftOf(aSeed), aOrder, e);
    vec3 mate = mix(aMateNoise + driftOf(aMateSeed), aMateOrder, e);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Echte Kantenlänge. Im Rauschzustand liegen die Partner weit
    // auseinander, die Linie fällt unter die Sichtbarkeitsschwelle.
    // Beim Ordnen schrumpfen die Kanten auf Ringabstand und erscheinen.
    vLen = length(pos - mate);
  }
`;

const lineFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uLine;
  uniform float uOrder;
  varying float vLen;

  void main() {
    // Ringnachbarn liegen zwischen 0.4 und 1.3 auseinander, Querkanten bei
    // rund 1.2. Alles darüber ist Rauschen und bleibt unsichtbar.
    float reach = smoothstep(2.9, 1.0, vLen);
    float alpha = reach * mix(0.06, 0.78, uOrder);
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(uLine, alpha);
  }
`;

export function createHeroScene(canvas, options) {
  const opts = options || {};
  const quality = opts.quality || 'high'; // 'high' | 'low'
  const rand = mulberry(20260729);

  // --- Positionen erzeugen --------------------------------------------------
  const noise = new Float32Array(NODE_COUNT * 3);
  const order = new Float32Array(NODE_COUNT * 3);
  const seeds = new Float32Array(NODE_COUNT);
  const accents = new Float32Array(NODE_COUNT);

  let i = 0;
  for (let r = 0; r < RING_COUNT; r++) {
    const radius = 3.1 + r * 1.55;
    const z = -2.4 + r * 1.15;
    const tilt = -0.21 + r * 0.045; // greift die Neigung der CSS-Orbits auf
    for (let k = 0; k < PER_RING; k++) {
      const a = (k / PER_RING) * Math.PI * 2 + r * 0.34;
      const wobble = 1 + (rand() - 0.5) * 0.06;
      const ox = Math.cos(a) * radius * wobble;
      const oy = Math.sin(a) * radius * wobble * 0.62;

      order[i * 3] = ox * Math.cos(tilt) - oy * Math.sin(tilt);
      order[i * 3 + 1] = ox * Math.sin(tilt) + oy * Math.cos(tilt);
      order[i * 3 + 2] = z + (rand() - 0.5) * 0.5;

      noise[i * 3] = (rand() - 0.5) * 26;
      noise[i * 3 + 1] = (rand() - 0.5) * 16;
      noise[i * 3 + 2] = (rand() - 0.5) * 13 - 2;

      seeds[i] = rand();
      accents[i] = rand() > 0.965 ? 1 : 0; // ~8 Messingknoten
      i++;
    }
  }

  // --- Punkte ---------------------------------------------------------------
  const pointGeo = new BufferGeometry();
  pointGeo.setAttribute('position', new BufferAttribute(order.slice(), 3));
  pointGeo.setAttribute('aNoise', new BufferAttribute(noise, 3));
  pointGeo.setAttribute('aOrder', new BufferAttribute(order, 3));
  pointGeo.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  pointGeo.setAttribute('aAccent', new BufferAttribute(accents, 1));

  const pointUniforms = {
    uTime: { value: 0 },
    uOrder: { value: 0 },
    uSize: { value: quality === 'low' ? 0.24 : 0.31 },
    uCobalt: { value: COBALT },
    uBlue: { value: BLUE },
    uBrass: { value: BRASS },
  };

  const points = new Points(
    pointGeo,
    new ShaderMaterial({
      uniforms: pointUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
  );

  // --- Verbindungen ---------------------------------------------------------
  // Nachbarn im Ring plus sparsame Querverbindungen. Die Paare stehen fest,
  // sichtbar werden sie erst, wenn die Ordnung sie kurz genug macht.
  const pairs = [];
  for (let r = 0; r < RING_COUNT; r++) {
    for (let k = 0; k < PER_RING; k++) {
      const a = r * PER_RING + k;
      pairs.push(a, r * PER_RING + ((k + 1) % PER_RING));
      if (r < RING_COUNT - 1 && k % 4 === 0) pairs.push(a, (r + 1) * PER_RING + k);
    }
  }

  const segCount = pairs.length;
  const lNoise = new Float32Array(segCount * 3);
  const lOrder = new Float32Array(segCount * 3);
  const mNoise = new Float32Array(segCount * 3);
  const mOrder = new Float32Array(segCount * 3);
  const lSeed = new Float32Array(segCount);
  const mSeed = new Float32Array(segCount);
  for (let s = 0; s < segCount; s++) {
    const idx = pairs[s];
    // Jedes Vertex kennt seinen Partner, damit der Shader die echte
    // Kantenlänge in jedem Mischzustand ausrechnen kann.
    const mate = pairs[s % 2 === 0 ? s + 1 : s - 1];
    for (let c = 0; c < 3; c++) {
      lNoise[s * 3 + c] = noise[idx * 3 + c];
      lOrder[s * 3 + c] = order[idx * 3 + c];
      mNoise[s * 3 + c] = noise[mate * 3 + c];
      mOrder[s * 3 + c] = order[mate * 3 + c];
    }
    lSeed[s] = seeds[idx];
    mSeed[s] = seeds[mate];
  }

  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(lOrder.slice(), 3));
  lineGeo.setAttribute('aNoise', new BufferAttribute(lNoise, 3));
  lineGeo.setAttribute('aOrder', new BufferAttribute(lOrder, 3));
  lineGeo.setAttribute('aMateNoise', new BufferAttribute(mNoise, 3));
  lineGeo.setAttribute('aMateOrder', new BufferAttribute(mOrder, 3));
  lineGeo.setAttribute('aSeed', new BufferAttribute(lSeed, 1));
  lineGeo.setAttribute('aMateSeed', new BufferAttribute(mSeed, 1));

  const lineUniforms = {
    uTime: { value: 0 },
    uOrder: { value: 0 },
    uLine: { value: LINE },
  };

  const lines = new LineSegments(
    lineGeo,
    new ShaderMaterial({
      uniforms: lineUniforms,
      vertexShader: lineVertexShader,
      fragmentShader: lineFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
  );

  // --- Szene ----------------------------------------------------------------
  const scene = new Scene();
  scene.add(lines);
  scene.add(points);

  const camera = new PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 13.5);

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
  let orderTarget = 0;
  let orderCurrent = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const cap = quality === 'low' ? 1.35 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Bei schmalen Viewports weiter weg, damit die Ringe im Bild bleiben.
    camera.position.z = w < 720 ? 17.5 : 13.5;
    // Kamera nach links versetzen, damit das Netz rechts neben dem Text sitzt.
    camera.position.x = w < 1100 ? -1.6 : -3.4;
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const t = (now - t0) / 1000;
    // Bildratenunabhängig glätten: der Faktor gilt pro 1/60 s, nicht pro Frame.
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const step = function (k) { return 1 - Math.pow(1 - k, dt * 60); };

    pointer.x += (pointer.tx - pointer.x) * step(0.045);
    pointer.y += (pointer.ty - pointer.y) * step(0.045);
    orderCurrent += (orderTarget - orderCurrent) * step(0.08);

    pointUniforms.uTime.value = t;
    lineUniforms.uTime.value = t;
    pointUniforms.uOrder.value = orderCurrent;
    lineUniforms.uOrder.value = orderCurrent;

    const sway = Math.sin(t * 0.08) * 0.06;
    scene.rotation.y = pointer.x * 0.22 + sway;
    scene.rotation.x = pointer.y * 0.15 - 0.03;

    renderer.render(scene, camera);
  }

  function start() {
    if (running || disposed) return;
    running = true;
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
    setOrder: function (v, immediate) {
      orderTarget = Math.min(1, Math.max(0, v));
      if (immediate) orderCurrent = orderTarget;
    },
    setPointer: function (x, y) {
      pointer.tx = x;
      pointer.ty = y;
    },
    dispose: function () {
      disposed = true;
      stop();
      pointGeo.dispose();
      lineGeo.dispose();
      points.material.dispose();
      lines.material.dispose();
      renderer.dispose();
    },
  };
}
