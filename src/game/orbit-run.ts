/* Orbit Run: steer a small ship down an asteroid tunnel.
   Endless run on 3 lives with a combo multiplier. The level rises with time and brings
   new hazards; score milestones open new zones with their own look. */
import * as THREE from "three";

export interface GameSfx {
  collect(combo: number): void;
  hit(): void;
  gameOver(): void;
  start(): void;
  blip(): void;
  levelUp(): void;
  zone(): void;
  power(): void;
}

export interface GameOptions {
  sfx: GameSfx;
  colors: { a: string; b: string };
  getBest(): number;
  setBest(n: number): void;
  reducedMotion: boolean;
  exitLabel: string;
  onExit(): void;
  soundButton?: { isOn(): boolean; toggle(): void };
}

export interface GameHandle {
  dispose(): void;
}

const LEVEL_TIME = 20; // seconds per level
const BASE_SPEED = 22;
const SPEED_PER_LEVEL = 7;
const MAX_SPEED = 70;
const LIVES = 3;
const MAGNET_TIME = 8;
const TUNNEL_R = 2.7;
const SHIP_Z = -4;
const FAR_Z = -120;

/* What each level adds. Levels beyond this list just get faster. */
const LEVEL_NOTES: Record<number, string> = {
  2: "Debris starts to drift",
  3: "Walls: fly through the open side",
  4: "Comets: red, fast and aimed at you",
};

interface Theme {
  name: string;
  a: string; // cores, ship, streaks
  b: string; // tunnel, debris edges
  bg: string;
  debris: string;
  sides: number; // tunnel cross-section
  twist: number; // ring rotation per unit of depth
  spin: number; // ring rotation per second
}

const ZONE_THEMES: (Omit<Theme, "a" | "b"> & Partial<Pick<Theme, "a" | "b">>)[] = [
  { name: "Deep Orbit", bg: "#02040a", debris: "#2a3145", sides: 40, twist: 0, spin: 0 },
  { name: "Solar Forge", a: "#ffc04d", b: "#ff4d2e", bg: "#140502", debris: "#43201a", sides: 6, twist: 0, spin: 0.25 },
  { name: "Neon Reef", a: "#7dffcb", b: "#22d3ee", bg: "#01110f", debris: "#143f3b", sides: 8, twist: 0.03, spin: -0.2 },
  { name: "Void Bloom", a: "#f08cff", b: "#8b6cff", bg: "#0c0318", debris: "#33204f", sides: 4, twist: 0.05, spin: 0.35 },
  { name: "Glacier Run", a: "#d8f6ff", b: "#6ab8ff", bg: "#04101f", debris: "#27405f", sides: 3, twist: 0.02, spin: -0.3 },
];

/* Score needed to enter a zone: 1000, 3000, 6000, 10000... */
const zoneStart = (zone: number) => (1000 * zone * (zone + 1)) / 2;
const zoneAt = (score: number) => {
  let z = 0;
  while (score >= zoneStart(z + 1)) z++;
  return z;
};

type PowerKind = "shield" | "magnet" | "repair";
const POWER_COLORS: Record<PowerKind, number> = { shield: 0x7cc8ff, magnet: 0xffd23f, repair: 0xff6b8a };

type Thing = {
  obj: THREE.Object3D;
  kind: "core" | "debris" | PowerKind;
  r: number;
  spin: THREE.Vector3;
  alive: boolean;
  orbit: number; // sideways drift, radians per second around the tunnel axis
  zMul: number; // speed relative to the tunnel
  hot: boolean; // comet: glowing, with a trail
  body?: THREE.Mesh;
  trail?: THREE.Mesh;
};

export function startOrbitRun(root: HTMLElement, o: GameOptions): GameHandle {
  root.innerHTML = `
    <canvas aria-label="Orbit Run game area" role="img"></canvas>
    <div class="g-flash"></div>
    <div class="g-banner" role="status"><b data-g="banner-title"></b><span data-g="banner-note"></span></div>
    <div class="g-hud">
      <div class="g-hud-main">
      <dl>
        <div><dt>Score</dt><dd data-g="score">0</dd></div>
        <div><dt>Level</dt><dd data-g="level">1</dd></div>
        <div class="g-lives"><dt>Lives</dt><dd data-g="lives" aria-label="3 lives">◆◆◆</dd></div>
        <div class="g-combo"><dt>Combo</dt><dd data-g="combo">x1</dd></div>
      </dl>
      <div class="g-zone">
        <span data-g="zone-name"></span>
        <div class="g-zone-bar" aria-hidden="true"><i data-g="zone-bar"></i></div>
        <span class="g-status" data-g="status"></span>
      </div>
      </div>
      <div class="g-hud-tools">
        ${o.soundButton ? `<button class="tool" type="button" data-g="sound" aria-pressed="false" aria-label="Sound"></button>` : ""}
        <button class="tool" type="button" data-g="pause" aria-label="Pause game"><svg class="ic" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg></button>
      </div>
    </div>
    <section class="g-screen" data-screen="start" aria-labelledby="g-start-title">
      <div class="g-card">
        <h2 id="g-start-title">Orbit Run</h2>
        <p>Collect data cores and dodge debris on 3 lives. The level rises every 20 seconds, and reaching 1,000 points opens a new zone.</p>
        <ul>
          <li>Steer: mouse, touch drag, arrow keys or WASD</li>
          <li>Pick-ups: shield, magnet and extra life</li>
          <li>Skim past debris for bonus points</li>
          <li>Pause: Esc</li>
        </ul>
        <p class="arcade-best" style="margin-top:14px">Best score <b data-g="best">0</b></p>
        <div class="cta">
          <button class="btn primary" type="button" data-g="go">Start run</button>
          <button class="btn" type="button" data-g="exit">${o.exitLabel}</button>
        </div>
      </div>
    </section>
    <section class="g-screen" data-screen="pause" hidden aria-labelledby="g-pause-title">
      <div class="g-card">
        <h2 id="g-pause-title">Paused</h2>
        <p>Your run is on hold.</p>
        <div class="cta">
          <button class="btn primary" type="button" data-g="resume">Resume</button>
          <button class="btn" type="button" data-g="restart">Restart</button>
          <button class="btn" type="button" data-g="exit">${o.exitLabel}</button>
        </div>
      </div>
    </section>
    <section class="g-screen" data-screen="over" hidden aria-labelledby="g-over-title">
      <div class="g-card" role="status">
        <h2 id="g-over-title">Run complete</h2>
        <p data-g="reason"></p>
        <p class="g-score" data-g="final">0</p>
        <p data-g="bestline"></p>
        <div class="cta">
          <button class="btn primary" type="button" data-g="again">Play again</button>
          <button class="btn" type="button" data-g="exit">${o.exitLabel}</button>
        </div>
      </div>
    </section>`;

  const q = <T extends HTMLElement = HTMLElement>(k: string) => root.querySelector(`[data-g="${k}"]`) as T;
  const qa = (k: string) => [...root.querySelectorAll<HTMLElement>(`[data-g="${k}"]`)];
  const screens = {
    start: root.querySelector<HTMLElement>('[data-screen="start"]')!,
    pause: root.querySelector<HTMLElement>('[data-screen="pause"]')!,
    over: root.querySelector<HTMLElement>('[data-screen="over"]')!,
  };
  const canvas = root.querySelector("canvas")!;
  const flash = root.querySelector<HTMLElement>(".g-flash")!;
  const banner = root.querySelector<HTMLElement>(".g-banner")!;
  q("best").textContent = String(o.getBest());

  // ---------- renderer ----------
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x02040a, 1);
  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0x02040a, 30, 115);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 160);
  camera.position.set(0, 1.1, 1);

  const colA = new THREE.Color(o.colors.a);
  const colB = new THREE.Color(o.colors.b);
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  scene.add(new THREE.AmbientLight(0x8899bb, 0.6));
  const key = new THREE.PointLight(colA, 30, 30);
  key.position.set(0, 2, -2);
  scene.add(key);

  // tunnel rings
  const ringMat = track(new THREE.LineBasicMaterial({ color: colB, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  function makeRingGeo(sides: number) {
    // sized so the flat sides of the polygon still clear the flight area
    const R = (TUNNEL_R + 0.6) / Math.cos(Math.PI / sides);
    const strutEvery = Math.max(1, Math.floor(sides / 8));
    const pts: number[] = [];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      pts.push(Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a1) * R, Math.sin(a1) * R, 0);
      if (i % strutEvery === 0) pts.push(Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a0) * R, Math.sin(a0) * R, -1.4);
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }
  const themes: Theme[] = ZONE_THEMES.map((t) => ({ a: o.colors.a, b: o.colors.b, ...t }) as Theme);
  const themeFor = (zone: number) => themes[zone % themes.length];
  const ringGeos = new Map(themes.map((t) => [t.sides, makeRingGeo(t.sides)]));
  const ringGeo = ringGeos.get(themes[0].sides)!;
  const rings: THREE.LineSegments[] = [];
  const RING_GAP = 5;
  for (let i = 0; i < 24; i++) {
    const r = new THREE.LineSegments(ringGeo, ringMat);
    r.position.z = -i * RING_GAP;
    scene.add(r);
    rings.push(r);
  }

  // speed streaks
  const STREAKS = 220;
  const streakGeo = track(new THREE.BufferGeometry());
  const streakPos = new Float32Array(STREAKS * 3);
  for (let i = 0; i < STREAKS; i++) {
    const a = Math.random() * Math.PI * 2, r = TUNNEL_R + 0.8 + Math.random() * 6;
    streakPos.set([Math.cos(a) * r, Math.sin(a) * r, FAR_Z * Math.random()], i * 3);
  }
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
  const streakMat = track(new THREE.PointsMaterial({ color: colA, size: 0.08, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const streaks = new THREE.Points(streakGeo, streakMat);
  scene.add(streaks);

  // ship
  const ship = new THREE.Group();
  const bodyMat = track(new THREE.MeshStandardMaterial({ color: 0x0c1424, emissive: colA, emissiveIntensity: 0.25, flatShading: true, metalness: 0.4, roughness: 0.5 }));
  const wingMat = track(new THREE.MeshBasicMaterial({ color: colA, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  const glowMat = track(new THREE.MeshBasicMaterial({ color: colB }));
  const bubble = new THREE.Mesh(
    track(new THREE.SphereGeometry(1.15, 16, 12)),
    track(new THREE.MeshBasicMaterial({ color: POWER_COLORS.shield, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  bubble.visible = false;
  ship.add(bubble);
  {
    const bodyGeo = track(new THREE.ConeGeometry(0.22, 0.9, 4));
    bodyGeo.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const wingGeo = track(new THREE.BufferGeometry());
    wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.1, -0.75, -0.05, 0.4, 0.75, -0.05, 0.4], 3));
    wingGeo.computeVertexNormals();
    const wings = new THREE.Mesh(wingGeo, wingMat);
    const glowGeo = track(new THREE.SphereGeometry(0.09, 8, 8));
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.z = 0.42;
    ship.add(body, wings, glow);
  }
  ship.scale.setScalar(0.62);
  ship.position.set(0, -0.6, SHIP_Z);
  scene.add(ship);

  // pooled objects
  const coreGeo = track(new THREE.OctahedronGeometry(0.3));
  const coreMat = track(new THREE.MeshBasicMaterial({ color: colA }));
  const coreHaloMat = track(new THREE.MeshBasicMaterial({ color: colA, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  const debrisGeos = [0.45, 0.6, 0.8].map((r) => track(new THREE.IcosahedronGeometry(r, 0)));
  const debrisMat = track(new THREE.MeshStandardMaterial({ color: 0x2a3145, flatShading: true, roughness: 0.9, metalness: 0.1 }));
  const debrisEdgeMat = track(new THREE.LineBasicMaterial({ color: colB, transparent: true, opacity: 0.6 }));
  const debrisEdges = debrisGeos.map((g) => track(new THREE.EdgesGeometry(g)));
  const cometMat = track(new THREE.MeshBasicMaterial({ color: 0xff5a36 }));
  const trailGeo = track(new THREE.ConeGeometry(0.5, 7, 8));
  trailGeo.rotateX(-Math.PI / 2); // tip points back up the tunnel, where the comet came from
  trailGeo.translate(0, 0, -3.5);
  const trailMat = track(new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));

  const things: Thing[] = [];
  function makeCore(): Thing {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(coreGeo, coreMat));
    const halo = new THREE.Mesh(coreGeo, coreHaloMat);
    halo.scale.setScalar(1.8);
    g.add(halo);
    scene.add(g);
    return { obj: g, kind: "core", r: 0.35, spin: new THREE.Vector3(0, 2.5, 0), alive: false, orbit: 0, zMul: 1, hot: false };
  }
  function makeDebris(i: number): Thing {
    const k = i % debrisGeos.length;
    const g = new THREE.Group();
    const body = new THREE.Mesh(debrisGeos[k], debrisMat);
    const trail = new THREE.Mesh(trailGeo, trailMat);
    g.add(body, new THREE.LineSegments(debrisEdges[k], debrisEdgeMat), trail);
    scene.add(g);
    return { obj: g, kind: "debris", r: [0.45, 0.6, 0.8][k] * 0.85, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2), alive: false, orbit: 0, zMul: 1, hot: false, body, trail };
  }
  const powerHaloGeo = track(new THREE.SphereGeometry(0.62, 12, 10));
  function makePower(kind: PowerKind, geos: THREE.BufferGeometry[]): Thing {
    const g = new THREE.Group();
    const mat = track(new THREE.MeshBasicMaterial({ color: POWER_COLORS[kind] }));
    geos.forEach((geo) => g.add(new THREE.Mesh(track(geo), mat)));
    g.add(new THREE.Mesh(powerHaloGeo, track(new THREE.MeshBasicMaterial({ color: POWER_COLORS[kind], transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }))));
    scene.add(g);
    return { obj: g, kind, r: 0.55, spin: new THREE.Vector3(0.4, 2, 0), alive: false, orbit: 0, zMul: 1, hot: false };
  }
  for (let i = 0; i < 26; i++) things.push(makeCore());
  for (let i = 0; i < 44; i++) things.push(makeDebris(i)); // walls use up to 12 at once
  things.push(
    makePower("shield", [new THREE.IcosahedronGeometry(0.38, 0)]),
    makePower("magnet", [new THREE.TorusGeometry(0.32, 0.1, 8, 20)]),
    makePower("repair", [new THREE.BoxGeometry(0.6, 0.2, 0.2), new THREE.BoxGeometry(0.2, 0.6, 0.2)]),
  );
  things.forEach((t) => (t.obj.visible = false));

  function spawn(kind: Thing["kind"], x: number, y: number, z = FAR_Z) {
    const t = things.find((t) => !t.alive && t.kind === kind);
    if (!t) return null;
    t.alive = true;
    t.obj.visible = true;
    t.obj.position.set(x, y, z);
    t.orbit = 0;
    setComet(t, false);
    return t;
  }

  function setComet(t: Thing, hot: boolean) {
    t.hot = hot;
    t.zMul = hot ? 1.7 : 1;
    if (t.body) t.body.material = hot ? cometMat : debrisMat;
    if (t.trail) t.trail.visible = hot;
    if (hot) t.obj.rotation.set(0, 0, 0); // keeps the trail lined up with the tunnel
  }

  /* Fills one half of the tunnel with debris and marks the open half with a line of cores. */
  function spawnWall() {
    const open = Math.random() * Math.PI * 2;
    for (const [r, n] of [[0.6, 3], [1.5, 4], [2.4, 5]] as const) {
      for (let i = 0; i < n; i++) {
        const a = open + Math.PI + (i / (n - 1) - 0.5) * Math.PI * 0.9;
        spawn("debris", Math.cos(a) * r, Math.sin(a) * r, FAR_Z - Math.random());
      }
    }
    for (let i = 0; i < 4; i++) spawn("core", Math.cos(open) * 1.5, Math.sin(open) * 1.5, FAR_Z - 2 + i * 5);
    spawnT = 0.9; // a moment to read the wall before anything else arrives
  }

  function spawnPower() {
    const choices: PowerKind[] = ["magnet"];
    if (!shield) choices.push("shield");
    if (lives < LIVES) choices.push("repair", "repair");
    const [x, y] = randInTunnel(0.8);
    spawn(choices[Math.floor(Math.random() * choices.length)], x, y);
  }

  const randInTunnel = (margin = 0.4) => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (TUNNEL_R - margin);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };

  // ---------- state ----------
  type Phase = "start" | "play" | "pause" | "over";
  let phase: Phase = "start";
  let score = 0, lives = LIVES, elapsed = 0, combo = 1, streak = 0;
  let speed = BASE_SPEED, spawnT = 0, invuln = 0, shake = 0;
  let level = 1, zone = 0, wallT = 0, powerT = 12, magnet = 0, shield = false;
  let warp = 0, settle = 0, twist = 0, spin = 0, ringAngle = 0, baseFov = 70;
  let ringGeoNow = ringGeo;
  const bannerQueue: [string, string][] = [];
  let bannerT = 0;
  const colorKeys = ["a", "b", "bg", "debris"] as const;
  const pal = { a: new THREE.Color(), b: new THREE.Color(), bg: new THREE.Color(), debris: new THREE.Color() };
  const goal = { a: new THREE.Color(), b: new THREE.Color(), bg: new THREE.Color(), debris: new THREE.Color() };
  const target = new THREE.Vector2(0, -0.6);
  const vel = new THREE.Vector2();
  const keys = new Set<string>();

  const hud = { score: q("score"), level: q("level"), lives: q("lives"), combo: q("combo"), zone: q("zone-name"), bar: q("zone-bar"), status: q("status") };
  function renderHud() {
    hud.score.textContent = String(score);
    hud.level.textContent = String(level);
    const from = zoneStart(zone);
    hud.bar.style.transform = `scaleX(${Math.min(1, (score - from) / (zoneStart(zone + 1) - from))})`;
    const status = [shield ? "Shield up" : "", magnet > 0 ? `Magnet ${Math.ceil(magnet)}` : ""].filter(Boolean).join(" · ");
    if (hud.status.textContent !== status) hud.status.textContent = status;
    hud.lives.textContent = "◆".repeat(lives) + "◇".repeat(LIVES - lives);
    hud.lives.setAttribute("aria-label", `${lives} ${lives === 1 ? "life" : "lives"}`);
    hud.combo.textContent = "x" + combo;
  }

  function show(which: Phase | null) {
    (Object.keys(screens) as (keyof typeof screens)[]).forEach((k) => (screens[k].hidden = k !== which));
    const s = which && which !== "play" ? screens[which as keyof typeof screens] : null;
    s?.querySelector<HTMLButtonElement>(".btn.primary")?.focus();
  }

  function reset() {
    score = 0; lives = LIVES; elapsed = 0; combo = 1; streak = 0;
    speed = BASE_SPEED; spawnT = 0; invuln = 0; shake = 0;
    level = 1; wallT = 0; powerT = 12; magnet = 0; shield = false; bubble.visible = false;
    warp = 0; bannerQueue.length = 0; bannerT = 0; banner.classList.remove("on");
    setZone(0);
    colorKeys.forEach((k) => pal[k].copy(goal[k]));
    settle = 0; twist = o.reducedMotion ? 0 : themes[0].twist; spin = o.reducedMotion ? 0 : themes[0].spin; ringAngle = 0;
    applyPalette();
    rings.forEach((r) => (r.geometry = ringGeoNow));
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    target.set(0, -0.6);
    ship.position.set(0, -0.6, SHIP_Z);
    ship.visible = true;
    things.forEach((t) => ((t.alive = false), (t.obj.visible = false)));
    renderHud();
  }

  function setZone(z: number) {
    zone = z;
    const th = themeFor(z);
    colorKeys.forEach((k) => goal[k].set(th[k]));
    settle = 3;
    // new rings pick this up as they wrap round, so the zone rolls in from the distance
    ringGeoNow = ringGeos.get(th.sides)!;
    root.style.setProperty("--a", th.a);
    root.style.setProperty("--b", th.b);
    hud.zone.textContent = th.name;
  }

  function applyPalette() {
    ringMat.color.copy(pal.b);
    debrisEdgeMat.color.copy(pal.b);
    glowMat.color.copy(pal.b);
    streakMat.color.copy(pal.a);
    wingMat.color.copy(pal.a);
    coreMat.color.copy(pal.a);
    coreHaloMat.color.copy(pal.a);
    bodyMat.emissive.copy(pal.a);
    key.color.copy(pal.a);
    debrisMat.color.copy(pal.debris);
    fog.color.copy(pal.bg);
    renderer.setClearColor(pal.bg, 1);
  }

  function enterZone(z: number) {
    setZone(z);
    const reached = themeFor(z).name;
    bannerQueue.unshift([`Zone ${z + 1}`, reached]);
    bannerT = 0;
    o.sfx.zone();
    if (!o.reducedMotion) {
      warp = 1;
      flashScreen("zone");
    }
  }

  function flashScreen(cls?: string) {
    if (cls) flash.classList.add(cls);
    flash.classList.add("on");
    requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.remove("on")));
    if (cls) setTimeout(() => flash.classList.remove(cls), 400);
  }

  function updateBanner(dt: number) {
    bannerT -= dt;
    if (bannerT > 0) return;
    const next = bannerQueue.shift();
    if (!next) {
      banner.classList.remove("on");
      return;
    }
    q("banner-title").textContent = next[0];
    q("banner-note").textContent = next[1];
    banner.classList.add("on");
    bannerT = 2;
  }

  function play() {
    reset();
    phase = "play";
    show("play");
    q("pause").focus(); // keep keyboard focus inside the game
    o.sfx.start();
    clock.getDelta();
  }

  function pause() {
    if (phase !== "play") return;
    phase = "pause";
    show("pause");
  }

  function resume() {
    if (phase !== "pause") return;
    phase = "play";
    show("play");
    clock.getDelta();
  }

  function end(reason: string) {
    phase = "over";
    o.sfx.gameOver();
    const best = o.getBest();
    const isBest = score > best;
    if (isBest) o.setBest(score);
    q("reason").textContent = `${reason} You reached level ${level} in ${themeFor(zone).name}.`;
    q("final").textContent = String(score);
    q("bestline").textContent = isBest ? "New best score." : `Best score: ${best}`;
    qa("best").forEach((b) => (b.textContent = String(Math.max(best, score))));
    show("over");
  }

  function popText(text: string, worldPos: THREE.Vector3) {
    const v = worldPos.clone().project(camera);
    const el = document.createElement("span");
    el.className = "g-pop";
    el.textContent = text;
    el.style.left = ((v.x + 1) / 2) * root.clientWidth + "px";
    el.style.top = ((1 - v.y) / 2) * root.clientHeight + "px";
    root.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  // ---------- input ----------
  let dragStart: { x: number; y: number; tx: number; ty: number } | null = null;
  const toTunnel = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1;
    const ny = -(((cy - r.top) / r.height) * 2 - 1);
    return [nx * TUNNEL_R * 1.15, ny * TUNNEL_R * 1.15] as const;
  };
  function clampTarget() {
    const l = target.length();
    const max = TUNNEL_R - 0.35;
    if (l > max) target.multiplyScalar(max / l);
  }
  const onPointerDown = (e: PointerEvent) => {
    if (phase !== "play") return;
    if (e.pointerType !== "mouse") dragStart = { x: e.clientX, y: e.clientY, tx: target.x, ty: target.y };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (phase !== "play") return;
    if (e.pointerType === "mouse") {
      const [x, y] = toTunnel(e.clientX, e.clientY);
      target.set(x, y);
    } else if (dragStart) {
      // relative drag so the finger never covers the ship
      const k = (TUNNEL_R * 2.4) / Math.min(root.clientWidth, root.clientHeight);
      target.set(dragStart.tx + (e.clientX - dragStart.x) * k, dragStart.ty - (e.clientY - dragStart.y) * k);
    }
    clampTarget();
  };
  const onPointerUp = () => (dragStart = null);
  canvas.addEventListener("pointerdown", onPointerDown);
  addEventListener("pointermove", onPointerMove);
  addEventListener("pointerup", onPointerUp);
  addEventListener("pointercancel", onPointerUp);

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.type === "keydown" && k === "escape") {
      e.preventDefault();
      if (phase === "play") pause();
      else if (phase === "pause") resume();
      return;
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
      if (phase === "play") e.preventDefault();
      if (e.type === "keydown") keys.add(k);
      else keys.delete(k);
    }
  };
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKey);

  const onVisibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onBlur = () => pause();
  addEventListener("blur", onBlur);

  const onClick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-g]");
    if (!b) return;
    switch (b.dataset.g) {
      case "go":
      case "again":
      case "restart":
        play();
        break;
      case "resume":
        resume();
        break;
      case "pause":
        phase === "play" ? pause() : resume();
        break;
      case "exit":
        o.onExit();
        break;
      case "sound":
        o.soundButton?.toggle();
        syncSound();
        break;
    }
  };
  root.addEventListener("click", onClick);

  function syncSound() {
    const b = q("sound");
    if (!b || !o.soundButton) return;
    const on = o.soundButton.isOn();
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Sound on. Turn sound off" : "Sound off. Turn sound on");
    b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-${on ? "vol" : "mute"}"/></svg>`;
  }
  syncSound();

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let raf = 0;
  const tmp = new THREE.Vector3();

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseFov = w / h < 0.8 ? 85 : 70;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  function step(dt: number, t: number) {
    elapsed += dt;
    speed = Math.min(MAX_SPEED, BASE_SPEED + (elapsed / LEVEL_TIME) * SPEED_PER_LEVEL);
    const nowLevel = 1 + Math.floor(elapsed / LEVEL_TIME);
    if (nowLevel !== level) {
      level = nowLevel;
      bannerQueue.push([`Level ${level}`, LEVEL_NOTES[level] ?? "Faster"]);
      o.sfx.levelUp();
      if (level === 3) wallT = 1; // show the first wall straight after the announcement
    }
    updateBanner(dt);
    if (magnet > 0) magnet = Math.max(0, magnet - dt);

    // keyboard steering
    const ax = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    const ay = (keys.has("arrowup") || keys.has("w") ? 1 : 0) - (keys.has("arrowdown") || keys.has("s") ? 1 : 0);
    if (ax || ay) {
      target.x += ax * dt * 6;
      target.y += ay * dt * 6;
      clampTarget();
    }
    const px = ship.position.x, py = ship.position.y;
    ship.position.x += (target.x - ship.position.x) * (1 - Math.exp(-dt * 10));
    ship.position.y += (target.y - ship.position.y) * (1 - Math.exp(-dt * 10));
    vel.set((ship.position.x - px) / dt, (ship.position.y - py) / dt);
    ship.rotation.z = THREE.MathUtils.clamp(-vel.x * 0.12, -0.8, 0.8);
    ship.rotation.x = THREE.MathUtils.clamp(vel.y * 0.06, -0.4, 0.4);
    if (invuln > 0) {
      invuln -= dt;
      ship.visible = Math.floor(t * 14) % 2 === 0 || invuln <= 0;
    }

    // spawning: denser as speed ramps
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = Math.max(0.16, 0.5 - (speed - BASE_SPEED) / 80);
      const roll = Math.random();
      if (roll < 0.14) {
        // a short arc of cores rewards committing to a line
        const a0 = Math.random() * Math.PI * 2, r = 1 + Math.random() * 1.2;
        for (let i = 0; i < 5; i++) spawn("core", Math.cos(a0 + i * 0.25) * r, Math.sin(a0 + i * 0.25) * r, FAR_Z - i * 3);
      } else if (roll < 0.5) {
        const [x, y] = randInTunnel();
        spawn("core", x, y);
      } else {
        const [x, y] = randInTunnel(0.2);
        const d = spawn("debris", x, y);
        const special = Math.random();
        if (d && level >= 4 && special < 0.2) {
          d.obj.position.set(ship.position.x, ship.position.y, FAR_Z);
          setComet(d, true);
        } else if (d && level >= 2 && special < 0.5) {
          d.orbit = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7);
        }
      }
    }
    if (level >= 3) {
      wallT -= dt;
      if (wallT <= 0) {
        wallT = Math.max(5, 11 - level * 0.75);
        spawnWall();
      }
    }
    powerT -= dt;
    if (powerT <= 0) {
      powerT = 11 + Math.random() * 7;
      spawnPower();
    }

    for (const th of things) {
      if (!th.alive) continue;
      const p = th.obj.position;
      const prevZ = p.z;
      p.z += speed * th.zMul * dt;
      if (th.orbit) {
        const c = Math.cos(th.orbit * dt), s = Math.sin(th.orbit * dt);
        const x = p.x;
        p.x = x * c - p.y * s;
        p.y = x * s + p.y * c;
      }
      if (!th.hot) {
        th.obj.rotation.x += th.spin.x * dt;
        th.obj.rotation.y += th.spin.y * dt;
        th.obj.rotation.z += th.spin.z * dt;
      }
      if (magnet > 0 && th.kind === "core" && p.z > SHIP_Z - 30 && p.z < SHIP_Z) {
        const k = 1 - Math.exp(-dt * 5);
        p.x += (ship.position.x - p.x) * k;
        p.y += (ship.position.y - p.y) * k;
      }
      // checked across the whole frame's movement so fast objects can't skip past the ship
      if (prevZ - 0.55 < SHIP_Z && p.z + 0.55 > SHIP_Z) {
        const dx = p.x - ship.position.x, dy = p.y - ship.position.y;
        const hitR = th.r + 0.32;
        if (dx * dx + dy * dy < hitR * hitR) {
          if (th.kind === "core") {
            streak++;
            combo = Math.min(5, 1 + Math.floor(streak / 3));
            const pts = 10 * combo;
            score += pts;
            o.sfx.collect(combo);
            popText("+" + pts, tmp.copy(p));
            th.alive = false;
            th.obj.visible = false;
          } else if (th.kind !== "debris") {
            th.alive = false;
            th.obj.visible = false;
            o.sfx.power();
            if (th.kind === "shield") {
              shield = true;
              bubble.visible = true;
              popText("Shield", tmp.copy(p));
            } else if (th.kind === "magnet") {
              magnet = MAGNET_TIME;
              popText("Magnet", tmp.copy(p));
            } else {
              lives = Math.min(LIVES, lives + 1);
              popText("+1 life", tmp.copy(p));
            }
          } else if (invuln > 0) {
            // still flashing from the last hit: the debris passes through
          } else if (shield) {
            shield = false;
            bubble.visible = false;
            invuln = 0.8;
            o.sfx.hit();
            popText("Blocked", tmp.copy(p));
            th.alive = false;
            th.obj.visible = false;
          } else {
            lives--;
            streak = 0;
            combo = 1;
            invuln = 1.3;
            o.sfx.hit();
            if (!o.reducedMotion) shake = 0.35;
            flashScreen();
            th.alive = false;
            th.obj.visible = false;
            if (lives <= 0) {
              renderHud();
              end("Out of lives.");
              return;
            }
          }
        } else if (th.kind === "debris" && invuln <= 0 && prevZ < SHIP_Z && p.z >= SHIP_Z && dx * dx + dy * dy < (hitR + 0.45) * (hitR + 0.45)) {
          // near miss: reward flying close
          const pts = 5 * combo;
          score += pts;
          popText("Close +" + pts, tmp.copy(p));
        }
      }
      if (p.z > 2) {
        if (th.kind === "core" && th.alive) {
          // a missed core breaks the streak but not the multiplier floor
          streak = Math.max(0, streak - 2);
          combo = Math.min(combo, 1 + Math.floor(streak / 3));
        }
        th.alive = false;
        th.obj.visible = false;
      }
    }

    const reachedZone = zoneAt(score);
    if (reachedZone !== zone) enterZone(reachedZone);

    renderHud();
  }

  function animateWorld(dt: number, moving: boolean) {
    if (settle > 0) {
      settle -= dt;
      const k = 1 - Math.exp(-dt * 2.5);
      colorKeys.forEach((c) => pal[c].lerp(goal[c], k));
      applyPalette();
      if (!o.reducedMotion) {
        const th = themeFor(zone);
        twist += (th.twist - twist) * k;
        spin += (th.spin - spin) * k;
      }
    }
    if (warp > 0) {
      warp = Math.max(0, warp - dt / 1.2);
      camera.fov = baseFov + warp * warp * 22;
      camera.updateProjectionMatrix();
    }
    const sp = (moving ? speed : 6) + warp * warp * 90;
    ringAngle += spin * dt;
    for (const r of rings) {
      r.position.z += sp * dt;
      if (r.position.z > 2) {
        r.position.z -= rings.length * RING_GAP;
        r.geometry = ringGeoNow;
      }
      r.rotation.z = ringAngle + r.position.z * twist;
    }
    const pos = streakGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < STREAKS; i++) {
      let z = pos.getZ(i) + sp * 1.4 * dt;
      if (z > 2) z = FAR_Z;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (phase === "pause") return; // last frame stays on screen; no GPU work while paused
    if (phase === "play") step(dt, t);
    animateWorld(dt, phase === "play");
    // camera follows the ship a little for a sense of banking
    camera.position.x += (ship.position.x * 0.35 - camera.position.x) * 0.08;
    camera.position.y += (1.1 + ship.position.y * 0.3 - camera.position.y) * 0.08;
    if (shake > 0) {
      shake -= dt;
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }
    camera.lookAt(ship.position.x * 0.2, ship.position.y * 0.2, -20);
    key.position.set(ship.position.x, ship.position.y + 1.5, SHIP_Z + 1);
    renderer.render(scene, camera);
  }

  setZone(0);
  colorKeys.forEach((k) => pal[k].copy(goal[k]));
  settle = 0;
  applyPalette();
  renderHud();
  show("start");
  loop();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onPointerMove);
      removeEventListener("pointerup", onPointerUp);
      removeEventListener("pointercancel", onPointerUp);
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKey);
      removeEventListener("resize", resize);
      removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("click", onClick);
      // the launcher reads the base palette from these when the game is next opened
      root.style.removeProperty("--a");
      root.style.removeProperty("--b");
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      root.innerHTML = "";
    },
  };
}
