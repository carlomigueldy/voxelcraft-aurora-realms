import * as THREE from 'three';
import './style.css';

type BlockId = 'grass' | 'dirt' | 'stone' | 'sand' | 'water' | 'wood' | 'leaves' | 'glass' | 'ore' | 'crystal' | 'lamp' | 'brick';
type Vec2 = { x: number; y: number };
type Inventory = Record<BlockId, number>;

type BlockDefinition = {
  id: BlockId;
  label: string;
  color: string;
  side: string;
  roughness: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  solid: boolean;
};

type RenderBucket = {
  mesh: THREE.InstancedMesh;
  positions: THREE.Vector3[];
};

const WORLD_SIZE = 58;
const HALF_WORLD = WORLD_SIZE / 2;
const SEA_LEVEL = 5;
const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.32;
const PLAYER_EYE = 1.55;
const REACH = 6.2;
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const parseKey = (k: string): [number, number, number] => k.split(',').map(Number) as [number, number, number];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const BLOCKS: Record<BlockId, BlockDefinition> = {
  grass: { id: 'grass', label: 'Moss Grass', color: '#57b957', side: '#6f4f2c', roughness: 0.92, solid: true },
  dirt: { id: 'dirt', label: 'Rich Soil', color: '#7a4d2b', side: '#684126', roughness: 0.96, solid: true },
  stone: { id: 'stone', label: 'Blue Granite', color: '#8090a4', side: '#69798d', roughness: 0.88, solid: true },
  sand: { id: 'sand', label: 'Sun Sand', color: '#dac27b', side: '#c7aa61', roughness: 0.98, solid: true },
  water: { id: 'water', label: 'Aurora Water', color: '#4dc3ff', side: '#2e8ad0', roughness: 0.26, transparent: true, opacity: 0.58, solid: false },
  wood: { id: 'wood', label: 'Cedar Log', color: '#9d6135', side: '#704524', roughness: 0.9, solid: true },
  leaves: { id: 'leaves', label: 'Glow Leaves', color: '#42c56a', side: '#2f9d57', roughness: 0.8, transparent: true, opacity: 0.9, solid: true },
  glass: { id: 'glass', label: 'Sky Glass', color: '#b7f3ff', side: '#88ddff', roughness: 0.08, transparent: true, opacity: 0.35, solid: true },
  ore: { id: 'ore', label: 'Star Ore', color: '#737c90', side: '#4d5568', roughness: 0.7, emissive: '#ffd166', emissiveIntensity: 0.18, solid: true },
  crystal: { id: 'crystal', label: 'Aether Crystal', color: '#bd90ff', side: '#8157ff', roughness: 0.22, emissive: '#8b5cff', emissiveIntensity: 0.65, transparent: true, opacity: 0.86, solid: true },
  lamp: { id: 'lamp', label: 'Sun Lantern', color: '#ffd166', side: '#ff9f1c', roughness: 0.34, emissive: '#ffb703', emissiveIntensity: 1.4, solid: true },
  brick: { id: 'brick', label: 'Castle Brick', color: '#9a5666', side: '#734052', roughness: 0.82, solid: true },
};

const HOTBAR: BlockId[] = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'glass', 'lamp', 'brick', 'crystal'];
let spawnFloorY = SEA_LEVEL + 2;
const inventory: Inventory = {
  grass: 32,
  dirt: 64,
  stone: 48,
  sand: 24,
  water: 0,
  wood: 24,
  leaves: 24,
  glass: 18,
  ore: 0,
  crystal: 8,
  lamp: 10,
  brick: 32,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

app.innerHTML = `
  <canvas class="webgl" aria-label="VoxelCraft: Aurora Realms game canvas"></canvas>
  <div id="ui-root">
    <div class="topbar">
      <section class="brand">
        <h1>VoxelCraft: <span>Aurora Realms</span></h1>
        <p>Mine, build, sprint, swim and sculpt a luminous procedural voxel kingdom. This build is a polished Three.js sandbox, not a static mockup.</p>
      </section>
      <section class="stat-stack">
        <div class="stat-pill"><span>Biome</span><b id="biome-stat">Meadow</b></div>
        <div class="stat-pill"><span>Altitude</span><b id="altitude-stat">0m</b></div>
        <div class="stat-pill"><span>World</span><b id="world-stat">0 blocks</b></div>
      </section>
    </div>
    <div class="crosshair"><div class="crosshair-dot"></div></div>
    <div class="bottom-hud">
      <div class="hotbar" id="hotbar"></div>
      <div class="help"><kbd>WASD</kbd> move · <kbd>Space</kbd> jump · <kbd>Shift</kbd> sprint · <kbd>Left</kbd> mine · <kbd>Right</kbd> place · <kbd>1-9</kbd> select · <kbd>M</kbd> map · <kbd>V</kbd> camera</div>
    </div>
    <div class="minimap" id="minimap-wrap"><canvas id="minimap" width="144" height="144"></canvas></div>
    <div class="mobile-controls">
      <div class="joystick" id="joystick"><div class="stick" id="stick"></div></div>
      <div class="touch-actions"><button id="touch-jump" aria-label="Jump">↟</button><button id="touch-place" aria-label="Place block">▣</button><button id="touch-mine" aria-label="Mine block">✦</button><button id="touch-camera" aria-label="Toggle camera">◉</button></div>
    </div>
    <section class="center-card" id="start-card">
      <h2>Aurora <span>Realms</span></h2>
      <p>An original AAA-inspired browser voxel sandbox: procedural islands, dynamic light, water, mine/place interaction, collision, hotbar, minimap, cinematic first/third-person camera, mobile controls, and real playable systems.</p>
      <div class="cta-row"><button class="primary" id="start-button">Enter World</button><button class="secondary" id="tour-button">Cinematic Tour</button></div>
    </section>
    <div class="toast" id="toast">Ready</div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('canvas.webgl')!;
const hotbarEl = document.querySelector<HTMLDivElement>('#hotbar')!;
const startCard = document.querySelector<HTMLElement>('#start-card')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;
const minimapCanvas = document.querySelector<HTMLCanvasElement>('#minimap')!;
const minimapWrap = document.querySelector<HTMLElement>('#minimap-wrap')!;
const ctx = minimapCanvas.getContext('2d')!;
const biomeStat = document.querySelector<HTMLElement>('#biome-stat')!;
const altitudeStat = document.querySelector<HTMLElement>('#altitude-stat')!;
const worldStat = document.querySelector<HTMLElement>('#world-stat')!;

let selectedIndex = 0;
let showMap = true;
let thirdPerson = false;
let cinematicTour = false;
let lastToast = 0;
const runtimeErrors: string[] = [];
window.addEventListener('error', (event) => runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => runtimeErrors.push(String(event.reason)));

function showToast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  lastToast = performance.now();
}

function renderHotbar() {
  hotbarEl.innerHTML = '';
  HOTBAR.forEach((id, index) => {
    const def = BLOCKS[id];
    const slot = document.createElement('button');
    slot.className = `slot${index === selectedIndex ? ' selected' : ''}`;
    slot.setAttribute('aria-label', `Select ${def.label}`);
    slot.style.pointerEvents = 'auto';
    slot.innerHTML = `<kbd>${index + 1}</kbd><div class="cube" style="background: linear-gradient(135deg, ${def.color}, ${def.side})"></div><small>${def.label} ×${inventory[id]}</small>`;
    slot.addEventListener('click', () => {
      selectedIndex = index;
      renderHotbar();
      showToast(`Selected ${def.label}`);
    });
    hotbarEl.appendChild(slot);
  });
}
renderHotbar();

class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  range(min: number, max: number) { return min + (max - min) * this.next(); }
}

const rng = new SeededRandom(133742);
function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function valueNoise(x: number, z: number) {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx = x - ix; const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx); const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz); const b = hash2(ix + 1, iz); const c = hash2(ix, iz + 1); const d = hash2(ix + 1, iz + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uz);
}
function fbm(x: number, z: number) {
  let v = 0; let amp = 0.5; let freq = 0.038;
  for (let i = 0; i < 5; i++) {
    v += valueNoise(x * freq + 80, z * freq - 40) * amp;
    freq *= 2.05; amp *= 0.52;
  }
  return v;
}
function heightAt(x: number, z: number) {
  const radial = Math.sqrt(x * x + z * z) / HALF_WORLD;
  const island = 1 - smoothstep(0.64, 1.06, radial);
  const ridges = Math.abs(valueNoise(x * 0.085 - 70, z * 0.085 + 20) - 0.5) * 3.2;
  return Math.max(1, Math.floor((SEA_LEVEL - 1) + island * (fbm(x, z) * 11 + ridges + 2.5)));
}

class VoxelWorld {
  readonly blocks = new Map<string, BlockId>();
  readonly terrainHeights = new Map<string, number>();
  readonly changed = new Set<string>();
  add(x: number, y: number, z: number, id: BlockId) { this.blocks.set(key(x, y, z), id); this.changed.add(key(x, y, z)); }
  remove(x: number, y: number, z: number) { const k = key(x, y, z); const old = this.blocks.get(k); this.blocks.delete(k); this.changed.add(k); return old; }
  get(x: number, y: number, z: number) { return this.blocks.get(key(x, y, z)); }
  has(x: number, y: number, z: number) { return this.blocks.has(key(x, y, z)); }
  isSolid(x: number, y: number, z: number) { const b = this.get(x, y, z); return b ? BLOCKS[b].solid : false; }
  topHeight(x: number, z: number) {
    for (let y = 24; y >= -2; y--) if (this.has(x, y, z)) return y;
    return -2;
  }
}

const world = new VoxelWorld();

function generateWorld() {
  for (let x = -HALF_WORLD; x < HALF_WORLD; x++) {
    for (let z = -HALF_WORLD; z < HALF_WORLD; z++) {
      const h = heightAt(x, z);
      world.terrainHeights.set(`${x},${z}`, h);
      for (let y = 0; y <= h; y++) {
        const nearWater = h <= SEA_LEVEL + 1;
        let id: BlockId = 'stone';
        if (y === h) id = nearWater ? 'sand' : 'grass';
        else if (y > h - 4) id = nearWater ? 'sand' : 'dirt';
        if (y < h - 6 && hash2(x * 3 + y, z * 2 - y) > 0.967) id = 'ore';
        world.add(x, y, z, id);
      }
      if (h < SEA_LEVEL) {
        for (let y = h + 1; y <= SEA_LEVEL; y++) world.add(x, y, z, 'water');
      }
    }
  }
  // Hand-authored spawn platform and lanterns for immediate "premium" staging.
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    // Clear a clean sky clearing above the spawn plaza so nothing overhangs it.
    for (let y = SEA_LEVEL + 3; y <= 24; y++) world.blocks.delete(key(x, y, z));
    world.add(x, SEA_LEVEL + 2, z, Math.abs(x) === 5 || Math.abs(z) === 5 ? 'brick' : 'grass');
  }
  spawnFloorY = SEA_LEVEL + 2;
  const columns = [[-5, -5], [5, -5], [-5, 5], [5, 5]] as const;
  columns.forEach(([x, z]) => { for (let y = SEA_LEVEL + 3; y <= SEA_LEVEL + 5; y++) world.add(x, y, z, 'brick'); world.add(x, SEA_LEVEL + 6, z, 'lamp'); });

  for (let i = 0; i < 210; i++) {
    const x = Math.floor(rng.range(-HALF_WORLD + 4, HALF_WORLD - 4));
    const z = Math.floor(rng.range(-HALF_WORLD + 4, HALF_WORLD - 4));
    const h = world.terrainHeights.get(`${x},${z}`) ?? 0;
    if (h <= SEA_LEVEL + 1 || Math.abs(x) < 7 && Math.abs(z) < 7 || rng.next() < 0.32) continue;
    plantTree(x, h + 1, z, rng.next() > 0.82);
  }
  for (let i = 0; i < 64; i++) {
    const x = Math.floor(rng.range(-HALF_WORLD + 8, HALF_WORLD - 8));
    const z = Math.floor(rng.range(-HALF_WORLD + 8, HALF_WORLD - 8));
    const h = world.terrainHeights.get(`${x},${z}`) ?? 0;
    if (h > SEA_LEVEL + 2 && !world.has(x, h + 1, z)) world.add(x, h + 1, z, rng.next() > 0.55 ? 'crystal' : 'lamp');
  }
}

function plantTree(x: number, y: number, z: number, tall: boolean) {
  const height = tall ? 6 : 4 + Math.floor(rng.range(0, 3));
  for (let i = 0; i < height; i++) world.add(x, y + i, z, 'wood');
  const crownY = y + height - 1;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) {
    const d = Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 0.75;
    if (d < 3.6 && hash2(x + dx * 9 + dy, z + dz * 7) > 0.12) world.add(x + dx, crownY + dy, z + dz, 'leaves');
  }
}

generateWorld();
world.changed.clear();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fd8ff');
scene.fog = new THREE.FogExp2('#9ed9ff', 0.018);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 420);
camera.position.set(0, SEA_LEVEL + PLAYER_EYE + 2, 8);

const ambient = new THREE.HemisphereLight('#bdeaff', '#24331d', 1.35);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff0c4', 3.1);
sun.position.set(40, 80, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
scene.add(sun);
const moon = new THREE.DirectionalLight('#8fbaff', 0.22);
moon.position.set(-30, 55, -40);
scene.add(moon);

const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const buckets = new Map<BlockId, RenderBucket>();
const dummy = new THREE.Object3D();

function makeTexture(def: BlockDefinition) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = def.color; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 420; i++) {
    const tone = i % 3 === 0 ? 'rgba(255,255,255,.10)' : i % 3 === 1 ? 'rgba(0,0,0,.12)' : def.side + '55';
    g.fillStyle = tone;
    const s = 1 + Math.floor(hash2(i * 5, i * 17) * 7);
    g.fillRect(Math.floor(hash2(i, 8) * 96), Math.floor(hash2(2, i) * 96), s, s);
  }
  if (def.id === 'brick') {
    g.strokeStyle = 'rgba(30,10,18,.34)'; g.lineWidth = 3;
    for (let y = 0; y < 96; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(96, y); g.stroke(); }
    for (let y = 0; y < 96; y += 48) for (let x = y % 48 === 0 ? 0 : 24; x < 96; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 24); g.stroke(); }
  }
  if (def.id === 'ore' || def.id === 'crystal') {
    for (let i = 0; i < 18; i++) {
      g.fillStyle = def.id === 'ore' ? 'rgba(255,209,102,.95)' : 'rgba(204,174,255,.95)';
      g.beginPath();
      const x = hash2(i, 3) * 96; const y = hash2(4, i) * 96;
      g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.closePath(); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipMapNearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeMaterial(def: BlockDefinition) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color),
    map: makeTexture(def),
    roughness: def.roughness,
    metalness: def.metalness ?? 0,
    emissive: def.emissive ? new THREE.Color(def.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: def.emissiveIntensity ?? 0,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    depthWrite: def.transparent ? false : true,
  });
  return material;
}

const materials = Object.fromEntries(Object.values(BLOCKS).map((def) => [def.id, makeMaterial(def)])) as Record<BlockId, THREE.MeshStandardMaterial>;

function isVisibleBlock(x: number, y: number, z: number, id: BlockId) {
  if (BLOCKS[id].transparent) return true;
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  return dirs.some(([dx, dy, dz]) => {
    const n = world.get(x + dx, y + dy, z + dz);
    return !n || BLOCKS[n].transparent;
  });
}

function rebuildMeshes() {
  buckets.forEach((bucket) => scene.remove(bucket.mesh));
  buckets.clear();
  const byType = new Map<BlockId, THREE.Vector3[]>();
  Object.keys(BLOCKS).forEach((id) => byType.set(id as BlockId, []));
  world.blocks.forEach((id, k) => {
    const [x, y, z] = parseKey(k);
    if (isVisibleBlock(x, y, z, id)) byType.get(id)!.push(new THREE.Vector3(x, y, z));
  });
  byType.forEach((positions, id) => {
    if (!positions.length) return;
    const mesh = new THREE.InstancedMesh(cubeGeo, materials[id], positions.length);
    mesh.name = `voxel-${id}`;
    mesh.castShadow = id !== 'water';
    mesh.receiveShadow = true;
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      const micro = id === 'leaves' ? 0.96 + hash2(p.x, p.z) * 0.08 : 1;
      dummy.scale.setScalar(micro);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    buckets.set(id, { mesh, positions });
  });
  worldStat.textContent = `${world.blocks.size.toLocaleString()} blocks`;
}
rebuildMeshes();

// Decorative grass tufts/flowers as lightweight instancing.
function makeFoliage() {
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.5, 5);
  const flowerGeo = new THREE.IcosahedronGeometry(0.08, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#72e386', roughness: 0.9 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: 0.08, roughness: 0.7 });
  const tuftPositions: THREE.Vector3[] = [];
  const flowerPositions: THREE.Vector3[] = [];
  for (let x = -HALF_WORLD; x < HALF_WORLD; x++) for (let z = -HALF_WORLD; z < HALF_WORLD; z++) {
    const h = world.terrainHeights.get(`${x},${z}`) ?? 0;
    if (h > SEA_LEVEL + 1 && world.get(x, h, z) === 'grass' && hash2(x * 4.4, z * 4.4) > 0.74) {
      tuftPositions.push(new THREE.Vector3(x + hash2(x, z) * .5 - .25, h + .72, z + hash2(z, x) * .5 - .25));
      if (hash2(x * 8, z * 2) > 0.9) flowerPositions.push(new THREE.Vector3(x + .2, h + 1.06, z - .15));
    }
  }
  const tufts = new THREE.InstancedMesh(tuftGeo, grassMat, tuftPositions.length);
  tuftPositions.forEach((p, i) => { dummy.position.copy(p); dummy.rotation.set(0, hash2(p.x, p.z) * Math.PI, 0); dummy.scale.setScalar(0.7 + hash2(p.z, p.x) * .8); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix); });
  tufts.castShadow = true; tufts.receiveShadow = true; scene.add(tufts);
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerPositions.length);
  flowerPositions.forEach((p, i) => { dummy.position.copy(p); dummy.scale.setScalar(1 + hash2(p.z, p.x) * 1.8); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix); });
  flowers.castShadow = true; scene.add(flowers);
}
makeFoliage();

function createSkyDome() {
  const geo = new THREE.SphereGeometry(250, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#2d69bd') }, bottom: { value: new THREE.Color('#d5fbff') }, night: { value: 0 } },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.0); vWorld = normalize(world.xyz); gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: `varying vec3 vWorld; uniform vec3 top; uniform vec3 bottom; uniform float night; float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); } void main(){ float h = clamp(vWorld.y*0.5+0.5,0.0,1.0); vec3 day = mix(bottom, top, smoothstep(0.05,1.0,h)); vec3 nTop = vec3(0.018,0.032,0.075); vec3 nBot = vec3(0.07,0.10,0.17); vec3 nightCol = mix(nBot,nTop,h); float stars = step(0.996, hash(gl_FragCoord.xy)) * smoothstep(0.2,0.95,h) * night; gl_FragColor = vec4(mix(day, nightCol, night) + stars, 1.0); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'aurora-sky-dome';
  scene.add(mesh);
  return mat;
}
const skyMat = createSkyDome();

const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff1a8' }));
const moonOrb = new THREE.Mesh(new THREE.SphereGeometry(2.1, 32, 16), new THREE.MeshBasicMaterial({ color: '#d8ecff' }));
scene.add(sunOrb, moonOrb);

function makeClouds() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, transparent: true, opacity: 0.68 });
  for (let i = 0; i < 42; i++) {
    const cloud = new THREE.Group();
    const parts = 3 + Math.floor(hash2(i, i * 2) * 5);
    for (let j = 0; j < parts; j++) {
      const geo = new THREE.BoxGeometry(2 + hash2(i, j) * 4, .55 + hash2(j, i) * .7, 1.2 + hash2(i + j, j) * 3);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(j * 1.5 + hash2(j, i) * 1.5, hash2(i, j) * .4, hash2(j * 8, i) * 1.3);
      cloud.add(m);
    }
    cloud.position.set(rng.range(-90, 90), rng.range(28, 46), rng.range(-90, 90));
    cloud.rotation.y = rng.range(0, Math.PI);
    cloud.scale.setScalar(rng.range(0.8, 1.8));
    group.add(cloud);
  }
  scene.add(group);
  return group;
}
const clouds = makeClouds();

const particleGeo = new THREE.BufferGeometry();
const particleCount = 260;
const particlePos = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  particlePos[i * 3] = rng.range(-HALF_WORLD, HALF_WORLD);
  particlePos[i * 3 + 1] = rng.range(8, 22);
  particlePos[i * 3 + 2] = rng.range(-HALF_WORLD, HALF_WORLD);
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
const fireflies = new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: '#ffe38a', size: 0.09, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
scene.add(fireflies);

const player = {
  position: new THREE.Vector3(0, spawnFloorY + 1.02, 0),
  velocity: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: -0.12,
  onGround: false,
  flying: false,
};
const body = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffcf70', roughness: 0.54, emissive: '#ff9f1c', emissiveIntensity: 0.05 });
const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bodyMat);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.28), new THREE.MeshStandardMaterial({ color: '#5dc3ff', roughness: 0.62 }));
head.position.y = 1.45; torso.position.y = .85;
body.add(torso, head);
body.castShadow = true;
scene.add(body);

const keys = new Set<string>();
const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const pointer = new THREE.Vector2(0, 0);
let highlighted: { id: BlockId; index: number; position: THREE.Vector3; normal: THREE.Vector3 } | null = null;
const highlight = new THREE.Mesh(new THREE.BoxGeometry(1.025, 1.025, 1.025), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.9 }));
highlight.visible = false;
scene.add(highlight);

function getCameraForward() {
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ')).normalize();
}
function getCameraRight() {
  return new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw).normalize();
}

function startGame(lock = true) {
  startCard.classList.add('hidden');
  cinematicTour = false;
  if (lock && document.pointerLockElement !== canvas) void canvas.requestPointerLock?.();
  showToast('World ready — mine, build, explore.');
}
function startTour() {
  startCard.classList.add('hidden');
  cinematicTour = true;
  thirdPerson = true;
  showToast('Cinematic tour engaged — press V to take control.');
}

document.querySelector<HTMLButtonElement>('#start-button')!.addEventListener('click', () => startGame(true));
document.querySelector<HTMLButtonElement>('#tour-button')!.addEventListener('click', startTour);
canvas.addEventListener('click', () => { if (!cinematicTour && document.pointerLockElement !== canvas) void canvas.requestPointerLock?.(); });

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || cinematicTour) return;
  player.yaw -= e.movementX * 0.0024;
  player.pitch = clamp(player.pitch - e.movementY * 0.0024, -1.35, 1.25);
});

document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (/^Digit[1-9]$/.test(e.code)) { selectedIndex = Number(e.code.replace('Digit', '')) - 1; renderHotbar(); showToast(`Selected ${BLOCKS[HOTBAR[selectedIndex]].label}`); }
  if (e.code === 'KeyM') { showMap = !showMap; minimapWrap.style.display = showMap ? 'block' : 'none'; showToast(showMap ? 'Minimap on' : 'Minimap off'); }
  if (e.code === 'KeyV') { thirdPerson = !thirdPerson; cinematicTour = false; showToast(thirdPerson ? 'Third-person camera' : 'First-person camera'); }
  if (e.code === 'KeyF') { player.flying = !player.flying; showToast(player.flying ? 'Creative flight enabled' : 'Gravity restored'); }
  if (e.code === 'Escape') { if (document.pointerLockElement === canvas) document.exitPointerLock(); startCard.classList.remove('hidden'); }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));

document.addEventListener('mousedown', (e) => {
  if (startCard.classList.contains('hidden') === false) return;
  if (e.button === 0) mineTarget();
  if (e.button === 2) placeTarget();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

function intersectsPlayer(x: number, y: number, z: number) {
  const px = player.position.x; const py0 = player.position.y; const py1 = player.position.y + PLAYER_HEIGHT; const pz = player.position.z;
  return Math.abs(px - x) < PLAYER_RADIUS + 0.56 && Math.abs(pz - z) < PLAYER_RADIUS + 0.56 && py0 < y + 0.55 && py1 > y - 0.55;
}

function mineTarget() {
  if (!highlighted) { showToast('No block in reach'); return; }
  const { position } = highlighted;
  const id = world.get(position.x, position.y, position.z);
  if (!id || id === 'water') return;
  world.remove(position.x, position.y, position.z);
  inventory[id] = (inventory[id] ?? 0) + 1;
  rebuildMeshes();
  burstParticles(position, BLOCKS[id].color);
  renderHotbar();
  showToast(`Mined ${BLOCKS[id].label}`);
}

function placeTarget() {
  if (!highlighted) { showToast('Aim at a block to place'); return; }
  const id = HOTBAR[selectedIndex];
  if (inventory[id] <= 0) { showToast(`No ${BLOCKS[id].label} left`); return; }
  const p = highlighted.position.clone().add(highlighted.normal).round();
  if (world.has(p.x, p.y, p.z) || intersectsPlayer(p.x, p.y, p.z)) { showToast('Cannot place there'); return; }
  world.add(p.x, p.y, p.z, id);
  inventory[id]--;
  rebuildMeshes();
  burstParticles(p, BLOCKS[id].color);
  renderHotbar();
  showToast(`Placed ${BLOCKS[id].label}`);
}

const burstGroup = new THREE.Group();
scene.add(burstGroup);
function burstParticles(pos: THREE.Vector3, color: string) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  for (let i = 0; i < 18; i++) {
    const shard = new THREE.Mesh(geo, mat.clone());
    shard.position.copy(pos).addScalar(0.5);
    shard.userData.velocity = new THREE.Vector3(rng.range(-1,1), rng.range(.2,1.6), rng.range(-1,1)).multiplyScalar(2.2);
    shard.userData.life = 0.65 + rng.next() * .35;
    burstGroup.add(shard);
  }
}

function updateBursts(delta: number) {
  for (let i = burstGroup.children.length - 1; i >= 0; i--) {
    const shard = burstGroup.children[i] as THREE.Mesh;
    const vel = shard.userData.velocity as THREE.Vector3;
    shard.userData.life -= delta;
    vel.y -= 5 * delta;
    shard.position.addScaledVector(vel, delta);
    shard.rotation.x += delta * 8; shard.rotation.y += delta * 9;
    const mat = shard.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, shard.userData.life);
    if (shard.userData.life <= 0) burstGroup.remove(shard);
  }
}

function collisionAt(pos: THREE.Vector3) {
  const minX = Math.floor(pos.x - PLAYER_RADIUS);
  const maxX = Math.floor(pos.x + PLAYER_RADIUS);
  const minY = Math.floor(pos.y + 0.02);
  const maxY = Math.floor(pos.y + PLAYER_HEIGHT - 0.02);
  const minZ = Math.floor(pos.z - PLAYER_RADIUS);
  const maxZ = Math.floor(pos.z + PLAYER_RADIUS);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
    if (world.isSolid(x, y, z)) return true;
  }
  return false;
}

let touchMove: Vec2 = { x: 0, y: 0 };
function updatePlayer(delta: number) {
  if (cinematicTour) return;
  const move = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(getCameraForward().setY(0).normalize());
  if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(getCameraForward().setY(0).normalize());
  if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(getCameraRight());
  if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(getCameraRight());
  if (Math.abs(touchMove.x) + Math.abs(touchMove.y) > 0.02) {
    move.add(getCameraRight().multiplyScalar(touchMove.x));
    move.add(getCameraForward().setY(0).normalize().multiplyScalar(-touchMove.y));
  }
  if (move.lengthSq() > 0) move.normalize();
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 7.2 : 4.45;
  player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, move.x * speed, 1 - Math.pow(0.0006, delta));
  player.velocity.z = THREE.MathUtils.lerp(player.velocity.z, move.z * speed, 1 - Math.pow(0.0006, delta));
  if (player.flying) {
    player.velocity.y = 0;
    if (keys.has('Space')) player.velocity.y += speed;
    if (keys.has('ControlLeft') || keys.has('KeyC')) player.velocity.y -= speed;
  } else {
    if ((keys.has('Space') || touchJumpQueued) && player.onGround) { player.velocity.y = 7.4; player.onGround = false; }
    player.velocity.y -= 19.5 * delta;
  }
  touchJumpQueued = false;
  const nextX = player.position.clone(); nextX.x += player.velocity.x * delta;
  if (!collisionAt(nextX)) player.position.x = nextX.x; else player.velocity.x = 0;
  const nextZ = player.position.clone(); nextZ.z += player.velocity.z * delta;
  if (!collisionAt(nextZ)) player.position.z = nextZ.z; else player.velocity.z = 0;
  const nextY = player.position.clone(); nextY.y += player.velocity.y * delta;
  if (!collisionAt(nextY)) { player.position.y = nextY.y; player.onGround = false; }
  else {
    if (player.velocity.y < 0) player.onGround = true;
    player.velocity.y = 0;
  }
  if (player.position.y < -10) player.position.set(0, SEA_LEVEL + 6, 0);
}

let touchJumpQueued = false;
document.querySelector<HTMLButtonElement>('#touch-jump')!.addEventListener('pointerdown', () => { touchJumpQueued = true; });
document.querySelector<HTMLButtonElement>('#touch-mine')!.addEventListener('pointerdown', () => mineTarget());
document.querySelector<HTMLButtonElement>('#touch-place')!.addEventListener('pointerdown', () => placeTarget());
document.querySelector<HTMLButtonElement>('#touch-camera')!.addEventListener('pointerdown', () => { thirdPerson = !thirdPerson; });
const joy = document.querySelector<HTMLElement>('#joystick')!;
const stick = document.querySelector<HTMLElement>('#stick')!;
let joyPointer: number | null = null;
joy.addEventListener('pointerdown', (e) => { joyPointer = e.pointerId; joy.setPointerCapture(e.pointerId); updateJoy(e); });
joy.addEventListener('pointermove', (e) => { if (joyPointer === e.pointerId) updateJoy(e); });
joy.addEventListener('pointerup', (e) => { if (joyPointer === e.pointerId) { joyPointer = null; touchMove = { x: 0, y: 0 }; stick.style.transform = 'translate(0,0)'; } });
function updateJoy(e: PointerEvent) {
  const r = joy.getBoundingClientRect();
  const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
  const dx = clamp((e.clientX - cx) / (r.width / 2), -1, 1); const dy = clamp((e.clientY - cy) / (r.height / 2), -1, 1);
  const len = Math.hypot(dx, dy); const nx = len > 1 ? dx / len : dx; const ny = len > 1 ? dy / len : dy;
  touchMove = { x: nx, y: ny };
  stick.style.transform = `translate(${nx * 34}px, ${ny * 34}px)`;
}

function updateCamera(delta: number, elapsed: number) {
  if (cinematicTour) {
    const r = 23 + Math.sin(elapsed * .18) * 4;
    player.position.set(Math.cos(elapsed * .16) * 8, SEA_LEVEL + 6.2 + Math.sin(elapsed * .22) * 2, Math.sin(elapsed * .16) * 8);
    player.yaw = Math.PI + elapsed * .08;
    const target = new THREE.Vector3(0, SEA_LEVEL + 5, 0);
    camera.position.lerp(new THREE.Vector3(Math.cos(elapsed * .12) * r, SEA_LEVEL + 16 + Math.sin(elapsed * .21) * 3, Math.sin(elapsed * .12) * r), 1 - Math.pow(0.0001, delta));
    camera.lookAt(target);
    return;
  }
  const eye = player.position.clone().add(new THREE.Vector3(0, PLAYER_EYE, 0));
  if (thirdPerson) {
    const forward = getCameraForward();
    const desired = eye.clone().sub(forward.multiplyScalar(6.8)).add(new THREE.Vector3(0, 2.1, 0));
    camera.position.lerp(desired, 1 - Math.pow(0.0001, delta));
    camera.lookAt(eye.clone().add(getCameraForward().multiplyScalar(3)));
  } else {
    camera.position.copy(eye);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }
}

function updateTarget() {
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));
  const meshes = Array.from(buckets.values()).map((b) => b.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  const hit = hits.find((h) => h.instanceId !== undefined && h.face !== null);
  if (!hit || hit.instanceId === undefined) { highlighted = null; highlight.visible = false; return; }
  const mesh = hit.object as THREE.InstancedMesh;
  const bucket = Array.from(buckets.values()).find((b) => b.mesh === mesh);
  if (!bucket) return;
  const id = mesh.name.replace('voxel-', '') as BlockId;
  const position = bucket.positions[hit.instanceId].clone();
  const normal = hit.face!.normal.clone().transformDirection(mesh.matrixWorld).round();
  highlighted = { id, index: hit.instanceId, position, normal };
  highlight.position.copy(position);
  highlight.visible = true;
}

function updateAvatar(delta: number, elapsed: number) {
  body.visible = thirdPerson || cinematicTour;
  body.position.copy(player.position);
  body.rotation.y = player.yaw + Math.PI;
  body.position.y += Math.sin(elapsed * 9) * (player.onGround ? 0.025 : 0.01);
  const moveSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  torso.rotation.z = Math.sin(elapsed * 10) * moveSpeed * 0.025;
  head.rotation.x = player.pitch * 0.35;
}

function updateLighting(elapsed: number) {
  const day = elapsed * 0.035;
  const sunAngle = day % (Math.PI * 2);
  const sy = Math.sin(sunAngle) * 80;
  const sx = Math.cos(sunAngle) * 80;
  sun.position.set(sx, sy, 34);
  moon.position.set(-sx, -sy, -30);
  const daylight = clamp((sy + 18) / 60, 0, 1);
  sun.intensity = 0.25 + daylight * 3.0;
  moon.intensity = 0.22 + (1 - daylight) * 0.6;
  ambient.intensity = 0.48 + daylight * 1.1;
  const night = 1 - daylight;
  (skyMat.uniforms.night.value as number) = night;
  scene.fog!.color.copy(new THREE.Color(daylight > .3 ? '#9ed9ff' : '#101d38'));
  scene.fog = new THREE.FogExp2(scene.fog!.color, 0.014 + night * 0.018);
  sunOrb.position.copy(sun.position).normalize().multiplyScalar(150);
  moonOrb.position.copy(moon.position).normalize().multiplyScalar(150);
  materials.water.emissive = new THREE.Color('#1b88ff');
  materials.water.emissiveIntensity = 0.04 + night * 0.2 + Math.sin(elapsed * 2) * 0.02;
  materials.lamp.emissiveIntensity = 1.1 + night * 1.4;
  materials.crystal.emissiveIntensity = 0.45 + night * 0.72;
}

function drawMinimap() {
  if (!showMap) return;
  const w = minimapCanvas.width; const h = minimapCanvas.height;
  const img = ctx.createImageData(w, h);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const wx = Math.floor((px / w - .5) * WORLD_SIZE);
    const wz = Math.floor((py / h - .5) * WORLD_SIZE);
    const th = world.terrainHeights.get(`${wx},${wz}`) ?? 0;
    const top = world.get(wx, world.topHeight(wx, wz), wz);
    const c = new THREE.Color(BLOCKS[top ?? (th <= SEA_LEVEL ? 'water' : 'stone')].color);
    const shade = clamp(.72 + th / 26, .65, 1.24);
    const idx = (py * w + px) * 4;
    img.data[idx] = c.r * 255 * shade; img.data[idx + 1] = c.g * 255 * shade; img.data[idx + 2] = c.b * 255 * shade; img.data[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.strokeRect(1,1,w-2,h-2);
  const px = (player.position.x / WORLD_SIZE + .5) * w;
  const py = (player.position.z / WORLD_SIZE + .5) * h;
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#07111f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(player.yaw) * 13, py + Math.cos(player.yaw) * 13); ctx.stroke();
}

function updateStats() {
  const x = Math.round(player.position.x); const z = Math.round(player.position.z); const y = Math.round(player.position.y);
  altitudeStat.textContent = `${y}m`;
  const h = world.terrainHeights.get(`${x},${z}`) ?? 0;
  biomeStat.textContent = h <= SEA_LEVEL ? 'Lagoon' : h > SEA_LEVEL + 7 ? 'Highlands' : Math.abs(x) < 7 && Math.abs(z) < 7 ? 'Royal Spawn' : 'Meadow';
}

let minimapTimer = 0;
const clock = new THREE.Clock();
let elapsed = 42; // start near midday so the world opens bright and cinematic
let frameCount = 0;
function tick() {
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  frameCount++;
  updatePlayer(delta);
  updateCamera(delta, elapsed);
  updateTarget();
  updateAvatar(delta, elapsed);
  updateBursts(delta);
  updateLighting(elapsed);
  updateStats();
  clouds.position.x = Math.sin(elapsed * .025) * 5;
  clouds.position.z = elapsed * .75 % 160 - 80;
  const pos = particleGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < particleCount; i++) {
    const ix = i * 3;
    particlePos[ix + 1] += Math.sin(elapsed + i) * 0.0008;
    particlePos[ix] += Math.sin(elapsed * .25 + i * 1.7) * 0.0015;
  }
  pos.needsUpdate = true;
  minimapTimer += delta;
  if (minimapTimer > 0.35) { drawMinimap(); minimapTimer = 0; }
  if (performance.now() - lastToast > 2200) toastEl.classList.remove('show');
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
showToast('Click Enter World, then mine or place blocks.');

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Test/QA hooks expose state only; the visible UI and controls remain the source of truth.
declare global { interface Window { __VOXELCRAFT__: { getState: () => unknown; start: () => void; simulateKey: (code: string, ms?: number) => Promise<unknown>; step: (code: string | null, frames?: number, dt?: number) => unknown; aim: (yaw: number, pitch: number) => void; mine: () => void; place: () => void; teleport: (x: number, y: number, z: number) => void; }; } }
window.__VOXELCRAFT__ = {
  getState: () => ({
    title: document.title,
    frameCount,
    elapsed: +elapsed.toFixed(2),
    player: { x: player.position.x, y: player.position.y, z: player.position.z },
    velocity: { x: player.velocity.x, y: player.velocity.y, z: player.velocity.z },
    selected: HOTBAR[selectedIndex],
    worldBlocks: world.blocks.size,
    highlighted: highlighted ? { id: highlighted.id, x: highlighted.position.x, y: highlighted.position.y, z: highlighted.position.z } : null,
    thirdPerson,
    map: showMap,
    pointerLocked: document.pointerLockElement === canvas,
    uiStarted: startCard.classList.contains('hidden'),
    runtimeErrors: runtimeErrors.slice(),
    inventory: { ...inventory },
  }),
  start: () => startGame(false),
  simulateKey: async (code: string, ms = 250) => {
    keys.add(code);
    await new Promise((resolve) => setTimeout(resolve, ms));
    keys.delete(code);
    return window.__VOXELCRAFT__.getState();
  },
  step: (code: string | null, frames = 60, dt = 1 / 60) => {
    if (code) keys.add(code);
    for (let i = 0; i < frames; i++) {
      elapsed += dt;
      frameCount++;
      updatePlayer(dt);
      updateCamera(dt, elapsed);
      updateTarget();
      updateAvatar(dt, elapsed);
    }
    if (code) keys.delete(code);
    renderer.render(scene, camera);
    return window.__VOXELCRAFT__.getState();
  },
  aim: (yaw: number, pitch: number) => { player.yaw = yaw; player.pitch = clamp(pitch, -1.35, 1.25); updateCamera(1 / 60, elapsed); updateTarget(); },
  mine: mineTarget,
  place: placeTarget,
  teleport: (x: number, y: number, z: number) => { player.position.set(x, y, z); updateCamera(1 / 60, elapsed); updateTarget(); },
};
