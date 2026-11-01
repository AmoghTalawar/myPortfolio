/* Clay-style workstation for the hero: a character seen from behind at a console desk,
   a monitor running a terminal, and a 3×2 shelf of hobby objects that react to hover.
   Everything is modelled from primitives in code, with no external assets. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { buildPerson } from "./person";

export interface DeskScene {
  root: THREE.Group;
  /** hoverable shelf items; each has userData.label */
  shelfItems: THREE.Object3D[];
  /** the floor lamp whose pull cord switches the theme */
  lamp: {
    /** generous invisible grab area around the thin cord */
    hit: THREE.Object3D[];
    /** pull is 0 at rest and 1 at full stretch; sway is the cord's swing in radians */
    setCord(pull: number, sway: number): void;
    setHot(hot: boolean): void;
    setLit(on: boolean): void;
    knobPosition(out: THREE.Vector3): THREE.Vector3;
  };
  screen: THREE.Mesh;
  /** the seated figure; hidden at the end of the dive so the camera can pass through */
  person: THREE.Group;
  animate(t: number): void;
  setHovered(item: THREE.Object3D | null): void;
  setTheme(light: boolean, accent: THREE.Color): void;
}

/* one label per hoverable shelf object, in cubby order; the plant in the last cubby is just decoration */
export const SHELF_LABELS = ["Reading books", "Cricket", "Gaming", "Watching movies", "Drawing"];

export function buildDeskScene(opts: {
  accent: THREE.Color;
  track: <T extends { dispose(): void }>(x: T) => T;
  shadows: boolean;
}): DeskScene {
  const { track } = opts;
  const root = new THREE.Group();

  // ---------- clay palette ----------
  const clay = (hex: number, rough = 0.85) => track(new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 }));
  const M = {
    desk: clay(0xdfe3ea),
    deskDark: clay(0xb9c0cc),
    chair: clay(0xc9ced8),
    chairDark: clay(0x6b7383),
    monitor: clay(0x1c212b, 0.6),
    bezel: clay(0x2b313d, 0.6),
    shelf: clay(0xd3d8e0),
    plant: clay(0x4f8a5b),
    pot: clay(0xb86b4b),
    paper: clay(0xf1f2f4),
    metal: track(new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.35, metalness: 0.6 })),
    glow: track(new THREE.MeshBasicMaterial({ color: opts.accent })),
  };
  M.glow.color = opts.accent;

  const rbox = (w: number, h: number, d: number, r = 0.05) => track(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    if (opts.shadows) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
    return o;
  };
  // ---------- desk ----------
  const desk = new THREE.Group();
  desk.add(mesh(rbox(3.8, 0.14, 1.5, 0.06), M.desk, 0, -0.6, -0.55));
  desk.add(mesh(rbox(0.14, 1.9, 1.4, 0.05), M.desk, -1.8, -1.6, -0.55));
  desk.add(mesh(rbox(1.1, 1.9, 1.4, 0.05), M.deskDark, 1.3, -1.6, -0.55)); // drawer unit
  for (let i = 0; i < 3; i++) desk.add(mesh(rbox(0.9, 0.5, 0.04, 0.02), M.desk, 1.3, -1.0 - i * 0.6, 0.17));
  root.add(desk);

  // ---------- monitor with a live terminal ----------
  const monitor = new THREE.Group();
  monitor.add(mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 12)), M.metal, 0, -0.3, -1.05));
  monitor.add(mesh(rbox(0.6, 0.05, 0.35, 0.02), M.metal, 0, -0.51, -1.0));
  monitor.add(mesh(rbox(2.0, 1.22, 0.08, 0.04), M.bezel, 0, 0.33, -1.1));
  const screenCanvas = document.createElement("canvas");
  // high resolution: at the end of the hero dive this screen fills the whole viewport
  screenCanvas.width = 1600;
  screenCanvas.height = 946;
  const screenTex = track(new THREE.CanvasTexture(screenCanvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = track(new THREE.MeshBasicMaterial({ map: screenTex }));
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(1.86, 1.1)), screenMat);
  screen.position.set(0, 0.33, -1.055);
  monitor.add(screen);
  root.add(monitor);

  const sctx = screenCanvas.getContext("2d")!;
  let screenLight = false;
  /* The monitor shows an "About" title card that matches the page's About heading,
     so diving into it hands off seamlessly to the real section. */
  function drawScreen(cursorOn: boolean) {
    const W = screenCanvas.width, H = screenCanvas.height;
    const acc = "#" + opts.accent.getHexString();
    const bg = screenLight ? "#fcfcfc" : "#000000";
    const ink = screenLight ? "#12151c" : "#f2f4f4";
    const muted = screenLight ? "#535d70" : "#9aa6bd";
    sctx.fillStyle = bg;
    sctx.fillRect(0, 0, W, H);
    // window chrome
    sctx.fillStyle = screenLight ? "#f6f6f7" : "#101416";
    sctx.fillRect(0, 0, W, 70);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
      sctx.fillStyle = c;
      sctx.beginPath();
      sctx.arc(44 + i * 34, 35, 10, 0, Math.PI * 2);
      sctx.fill();
    });
    sctx.textBaseline = "middle";
    sctx.font = '500 26px "Martian Mono Variable", ui-monospace, monospace';
    sctx.fillStyle = acc;
    sctx.fillText("amogh@deck:~$ whoami" + (cursorOn ? "▍" : ""), 170, 36);
    // title card
    sctx.textAlign = "center";
    sctx.fillStyle = ink;
    sctx.font = '500 170px "Fraunces Variable", Georgia, serif';
    sctx.fillText("✦ About", W / 2, H * 0.42);
    sctx.fillStyle = muted;
    sctx.font = '400 46px "Instrument Sans Variable", system-ui, sans-serif';
    sctx.fillText("What I work on", W / 2, H * 0.58);
    sctx.fillStyle = acc;
    sctx.font = '500 34px "Martian Mono Variable", ui-monospace, monospace';
    sctx.fillText("Amogh Talawar", W / 2, H * 0.72);
    sctx.textAlign = "left";
    screenTex.needsUpdate = true;
  }  drawScreen(true);

  // keyboard, laptop, mug, notebook
  root.add(mesh(rbox(1.1, 0.05, 0.36, 0.02), M.chairDark, 0, -0.51, -0.35));
  const laptop = new THREE.Group();
  laptop.add(mesh(rbox(0.95, 0.05, 0.65, 0.02), M.metal, 0, 0, 0));
  const lid = mesh(rbox(0.95, 0.62, 0.04, 0.02), M.metal, 0, 0.3, -0.32);
  lid.rotation.x = -0.35;
  laptop.add(lid);
  // the laptop is mid-way through an AWS course; text is large because this screen renders small
  const awsCanvas = document.createElement("canvas");
  awsCanvas.width = 1024;
  awsCanvas.height = 626;
  const awsTex = track(new THREE.CanvasTexture(awsCanvas));
  awsTex.colorSpace = THREE.SRGBColorSpace;
  awsTex.anisotropy = 4;
  const actx = awsCanvas.getContext("2d")!;
  const AWS_TOPICS = ["EC2", "S3", "IAM", "VPC"];
  const AWS_ORANGE = "#ff9900";
  function drawLaptop(active: number) {
    const W = awsCanvas.width, H = awsCanvas.height;
    actx.fillStyle = "#232f3e";
    actx.fillRect(0, 0, W, H);
    // wordmark with its smile
    actx.textBaseline = "middle";
    actx.textAlign = "center";
    actx.fillStyle = "#ffffff";
    actx.font = '700 170px "Instrument Sans Variable", system-ui, sans-serif';
    actx.fillText("aws", W / 2, 112);
    actx.strokeStyle = AWS_ORANGE;
    actx.lineWidth = 16;
    actx.lineCap = "round";
    actx.beginPath();
    actx.moveTo(W / 2 - 150, 194);
    actx.quadraticCurveTo(W / 2 - 10, 262, W / 2 + 150, 188);
    actx.stroke();
    // topic tiles, with one being studied right now
    const gap = 22, tileW = (W - 112 - gap * 3) / 4, tileY = 290, tileH = 176;
    AWS_TOPICS.forEach((topic, i) => {
      const x = 56 + i * (tileW + gap);
      const on = i === active;
      actx.fillStyle = on ? AWS_ORANGE : "#37475a";
      actx.beginPath();
      actx.roundRect(x, tileY, tileW, tileH, 16);
      actx.fill();
      actx.fillStyle = on ? "#232f3e" : "#ffffff";
      actx.font = '700 64px "Instrument Sans Variable", system-ui, sans-serif';
      actx.textAlign = "center";
      actx.fillText(topic, x + tileW / 2, tileY + tileH / 2);
    });
    // course progress follows the topic being studied
    actx.fillStyle = "#37475a";
    actx.fillRect(56, 516, W - 112, 30);
    actx.fillStyle = AWS_ORANGE;
    actx.fillRect(56, 516, (W - 112) * ((active + 1) / AWS_TOPICS.length), 30);
    awsTex.needsUpdate = true;
  }
  drawLaptop(0);
  const lidScreen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.85, 0.52)), track(new THREE.MeshBasicMaterial({ map: awsTex })));
  lidScreen.position.set(0, 0.3, -0.29);
  lidScreen.rotation.x = -0.35;
  lidScreen.scale.setScalar(0.98);
  laptop.add(lidScreen);
  laptop.position.set(-1.25, -0.5, -0.55);
  laptop.rotation.y = 0.45;
  root.add(laptop);

  // ---------- gadgets on the desk: two from real projects, three everyday ones ----------
  const TOP = -0.53; // the desk's surface
  const rubber = clay(0x23272f, 0.9);

  // USRP B210 radio with two antennas, from the private 5G testbed
  const usrp = new THREE.Group();
  usrp.add(mesh(rbox(0.36, 0.1, 0.24, 0.02), M.metal, 0, 0.05, 0));
  usrp.add(mesh(rbox(0.3, 0.012, 0.18, 0.004), M.chairDark, 0, 0.104, 0));
  for (const s of [-1, 1]) {
    usrp.add(mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 10)), M.metal, s * 0.1, 0.13, -0.08));
    usrp.add(mesh(track(new THREE.CylinderGeometry(0.014, 0.02, 0.46, 10)), rubber, s * 0.1, 0.38, -0.08));
  }
  usrp.position.set(1.48, TOP, -1.1);
  usrp.rotation.y = -0.3;
  usrp.scale.setScalar(1.25);
  root.add(usrp);

  // Raspberry Pi 5, from the surveillance project
  const pi = new THREE.Group();
  pi.add(mesh(rbox(0.36, 0.02, 0.24, 0.006), clay(0x1f7a4d), 0, 0.02, 0));
  pi.add(mesh(rbox(0.1, 0.03, 0.1, 0.006), M.metal, -0.06, 0.045, 0));
  pi.add(mesh(track(new THREE.CylinderGeometry(0.038, 0.038, 0.016, 16)), rubber, 0.09, 0.04, -0.03));
  for (let i = 0; i < 3; i++) pi.add(mesh(rbox(0.06, 0.05, 0.05, 0.006), M.metal, 0.17, 0.055, -0.07 + i * 0.07));
  pi.add(mesh(rbox(0.24, 0.018, 0.018, 0.003), rubber, -0.03, 0.04, -0.1));
  pi.position.set(1.14, TOP, -0.74);
  pi.rotation.y = -0.2;
  pi.scale.setScalar(1.25);
  root.add(pi);

  // phone, face up with its screen on
  const phone = new THREE.Group();
  phone.add(mesh(rbox(0.18, 0.02, 0.36, 0.008), rubber, 0, 0.01, 0));
  const phoneScreen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.155, 0.32)), track(new THREE.MeshBasicMaterial({ color: 0x1fb69b })));
  phoneScreen.rotation.x = -Math.PI / 2;
  phoneScreen.position.y = 0.0215;
  phone.add(phoneScreen);
  phone.position.set(-1.3, TOP, -0.03);
  phone.rotation.y = 0.4;
  phone.scale.setScalar(1.15);
  root.add(phone);

  // wireless mouse, beside the keyboard
  const mouse = new THREE.Group();
  const mouseBody = mesh(track(new THREE.SphereGeometry(0.09, 18, 12)), rubber, 0, 0.03, 0);
  mouseBody.scale.set(0.72, 0.42, 1.1);
  mouse.add(mouseBody);
  mouse.add(mesh(track(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 8)), M.metal, 0, 0.066, -0.045));
  mouse.children[1].rotation.z = Math.PI / 2;
  mouse.position.set(0.68, TOP, -0.2);
  root.add(mouse);

  // earbuds in their open case
  const buds = new THREE.Group();
  buds.add(mesh(rbox(0.17, 0.08, 0.12, 0.035), M.paper, 0, 0.04, 0));
  const budsLid = mesh(rbox(0.17, 0.03, 0.12, 0.014), M.paper, 0, 0.1, -0.075);
  budsLid.rotation.x = -1.05;
  buds.add(budsLid);
  for (const s of [-1, 1]) buds.add(mesh(track(new THREE.SphereGeometry(0.026, 10, 8)), clay(0xffffff, 0.5), s * 0.04, 0.09, 0.005));
  buds.position.set(1.6, TOP, -0.06);
  buds.rotation.y = -0.4;
  root.add(buds);

  const mug = new THREE.Group();
  mug.add(mesh(track(new THREE.CylinderGeometry(0.13, 0.12, 0.3, 20)), M.paper));
  const handle = mesh(track(new THREE.TorusGeometry(0.08, 0.025, 8, 16)), M.paper, 0.15, 0, 0);
  mug.add(handle);
  // hot coffee: a dark surface inside the rim, with steam curling up from it
  const coffee = new THREE.Mesh(track(new THREE.CircleGeometry(0.108, 24)), clay(0x3a2214, 0.35));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.152;
  mug.add(coffee);
  const steamMat = track(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(0xffffff) }, strength: { value: 0.4 } },
    // always faces the camera, so the steam looks the same from every angle of the dive
    vertexShader: `
      varying vec2 p;
      void main() {
        p = vec2(position.x / 0.32, position.y / 0.95);
        vec4 view = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        view.xy += position.xy;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying vec2 p;
      uniform float time;
      uniform vec3 tint;
      uniform float strength;
      // one wisp: it starts thin at the coffee, then widens and sways more as it rises
      float wisp(float seed) {
        float y = p.y, t = time * 0.9 + seed * 7.0;
        float centre = (seed - 0.5) * 0.4 * (1.0 - y)
          + sin(y * 6.5 - t * 1.5) * 0.22 * y
          + sin(y * 14.0 - t * 2.3 + seed * 5.0) * 0.07 * y;
        float width = 0.05 + 0.2 * y;
        float d = (p.x - centre) / width;
        return exp(-d * d) * (0.65 + 0.35 * sin(t * 0.7));
      }
      void main() {
        float fade = smoothstep(0.0, 0.1, p.y) * (1.0 - smoothstep(0.35, 1.0, p.y));
        float a = wisp(0.2) + wisp(0.5) + wisp(0.85);
        gl_FragColor = vec4(tint, min(a, 1.0) * fade * strength);
      }`,
  }));
  const steamShape = track(new THREE.PlaneGeometry(0.64, 0.95));
  steamShape.translate(0, 0.475, 0);
  const steam = new THREE.Mesh(steamShape, steamMat);
  steam.position.y = 0.155;
  steam.frustumCulled = false;
  steam.renderOrder = 1;
  mug.add(steam);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  mug.position.set(0.88, -0.38, -0.38);
  root.add(mug);
  const notebook = mesh(rbox(0.5, 0.06, 0.65, 0.02), M.paper, 1.62, -0.5, -0.5);
  notebook.rotation.y = -0.3;
  notebook.scale.setScalar(0.72);
  root.add(notebook);

  // ---------- floor lamp beside the desk: its cord switches the theme ----------
  const lamp = new THREE.Group();
  lamp.position.set(-2.55, 0, -0.35);
  lamp.add(mesh(track(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 28)), M.chairDark, 0, -2.53, 0));
  lamp.add(mesh(track(new THREE.CylinderGeometry(0.022, 0.022, 3.32, 12)), M.metal, 0, -0.87, 0));
  const shadeMat = track(new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.85, side: THREE.DoubleSide, emissive: 0xffb45c, emissiveIntensity: 0 }));
  lamp.add(mesh(track(new THREE.CylinderGeometry(0.24, 0.44, 0.5, 32, 1, true)), shadeMat, 0, 0.98, 0));
  lamp.add(mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10)), M.metal, 0, 0.8, 0));
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: 0xb9bdc4 }));
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 16, 12)), bulbMat);
  bulb.position.set(0, 0.8, 0);
  lamp.add(bulb);
  // the bulb lights the whole room, not just a pool under the shade
  const lampLight = new THREE.PointLight(0xffc98a, 0, 0, 1.4);
  lampLight.position.set(0, 0.8, 0);
  lamp.add(lampLight);
  // the room has no real walls, so its wall and floor exist only as the lamp's glow falling on them
  const glowMat = (cx: number, cy: number, peak: number) => track(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { spot: { value: new THREE.Vector2(cx, cy) }, peak: { value: peak } },
    vertexShader: "varying vec2 p; void main() { p = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      varying vec2 p;
      uniform vec2 spot;
      uniform float peak;
      void main() {
        float d = distance(p, spot) / 4.6;
        // slow falloff so the far side of the room still gets light; the noise hides banding in the dark
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        gl_FragColor = vec4(1.0, 0.72, 0.42, peak / (1.0 + d * d) + grain / 180.0);
      }`,
  }));
  const LAMP_X = lamp.position.x, LAMP_Z = lamp.position.z, FLOOR_Y = -2.56, WALL_Z = -2;
  const wallGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 20)), glowMat(LAMP_X, 0.8 - (FLOOR_Y + 10), 0.42));
  wallGlow.position.set(0, FLOOR_Y + 10, WALL_Z);
  const floorGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 24)), glowMat(LAMP_X, WALL_Z + 12 - LAMP_Z, 0.5));
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, FLOOR_Y, WALL_Z + 12);
  for (const g of [wallGlow, floorGlow]) {
    g.renderOrder = -2;
    g.visible = false;
    root.add(g);
  }
  // the cord hangs from the shade; its group swings and its length stretches when pulled
  const cord = new THREE.Group();
  cord.position.set(0.24, 0.76, 0);
  const CORD_REST = 0.66, CORD_STRETCH = 0.36;
  const cordLine = mesh(track(new THREE.CylinderGeometry(0.009, 0.009, 1, 8)), M.chairDark);
  const knobMat = track(new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.45, emissive: 0xffb703, emissiveIntensity: 0 }));
  const knob = mesh(track(new THREE.SphereGeometry(0.058, 16, 12)), knobMat);
  cord.add(cordLine, knob);
  const grabMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const grabCord = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, CORD_REST, 8)), grabMat);
  grabCord.position.y = -CORD_REST / 2;
  const grabKnob = new THREE.Mesh(track(new THREE.SphereGeometry(0.2, 10, 8)), grabMat);
  grabKnob.position.y = -CORD_REST;
  cord.add(grabCord, grabKnob);
  lamp.add(cord);
  root.add(lamp);
  const setCord = (pull: number, sway: number) => {
    const length = CORD_REST + pull * CORD_STRETCH;
    cordLine.scale.y = length;
    cordLine.position.y = -length / 2;
    knob.position.y = -length;
    cord.rotation.z = sway;
  };
  setCord(0, 0);

  // ---------- chair ----------
  const chair = new THREE.Group();
  chair.add(mesh(rbox(1.05, 0.16, 0.95, 0.07), M.chairDark, 0, -1.25, 0.65));
  const back = mesh(rbox(0.92, 0.82, 0.14, 0.08), M.chair, 0, -0.78, 1.12);
  back.rotation.x = 0.08;
  chair.add(back);
  // mesh-look stripes on the backrest
  for (let i = 0; i < 4; i++) chair.add(mesh(rbox(0.74, 0.04, 0.02, 0.01), M.chairDark, 0, -1.08 + i * 0.18, 1.2));
  chair.add(mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 12)), M.metal, 0, -1.75, 0.65));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = mesh(rbox(0.6, 0.06, 0.08, 0.02), M.metal, Math.cos(a) * 0.3, -2.2, 0.65 + Math.sin(a) * 0.3);
    leg.rotation.y = -a;
    chair.add(leg);
  }
  root.add(chair);

  // ---------- character (seen from behind) ----------
  const person = buildPerson({ track, shadows: opts.shadows, reduceMotion });
  root.add(person.group);

  // ---------- shelf (3 × 2 cubbies) ----------
  const shelf = new THREE.Group();
  shelf.position.set(0, 2.05, -1.35);
  const SW = 3.8, SH = 2.0, SD = 0.75, T = 0.1;
  shelf.add(mesh(rbox(SW, SH, 0.08, 0.04), M.shelf, 0, 0, -SD / 2));
  for (const y of [-SH / 2, 0, SH / 2]) shelf.add(mesh(rbox(SW, T, SD, 0.04), M.shelf, 0, y, 0));
  for (const x of [-SW / 2, -SW / 6, SW / 6, SW / 2]) shelf.add(mesh(rbox(T, SH, SD, 0.04), M.shelf, x, 0, 0));
  root.add(shelf);

  const cubby = (i: number) => new THREE.Vector3(((i % 3) - 1) * (SW / 3), i < 3 ? SH / 4 - 0.18 : -SH / 4 - 0.18, 0.02);
  const bright = [0x4f7cac, 0xc9a227, 0x8a5a9e, 0xb5523b, 0x3f8f7a];
  const builders: ((g: THREE.Group) => void)[] = [
    // 1: stack of books
    (g) => [0, 1, 2, 3, 4].forEach((k) => {
      const b = mesh(rbox(0.75 - k * 0.04, 0.1, 0.5, 0.02), clay(bright[k]), (k % 2) * 0.04, -0.12 + k * 0.105, 0);
      b.rotation.y = (k % 2 ? 0.12 : -0.08);
      g.add(b);
    }),
    // 2: cricket bat and ball
    (g) => {
      const bat = new THREE.Group();
      bat.add(mesh(rbox(0.17, 0.46, 0.06, 0.03), clay(0xd9b27c)));
      bat.add(mesh(track(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 10)), M.chairDark, 0, 0.33, 0));
      bat.position.set(-0.1, 0.05, 0);
      bat.rotation.z = -0.22;
      g.add(bat);
      g.add(mesh(track(new THREE.SphereGeometry(0.11, 20, 14)), clay(0xa8322a), 0.22, -0.09, 0.05));
      const seam = mesh(track(new THREE.TorusGeometry(0.11, 0.008, 6, 32)), M.paper, 0.22, -0.09, 0.05);
      seam.rotation.set(0.5, 0.9, 0);
      g.add(seam);
    },
    // 3: game controller
    (g) => {
      g.add(mesh(rbox(0.56, 0.22, 0.12, 0.06), M.chairDark, 0, 0.02, 0));
      for (const s of [-1, 1]) {
        const grip = mesh(rbox(0.15, 0.2, 0.11, 0.05), M.chairDark, s * 0.2, -0.08, 0);
        grip.rotation.z = s * 0.3;
        g.add(grip);
      }
      g.add(mesh(rbox(0.11, 0.035, 0.02, 0.008), M.paper, -0.15, 0.03, 0.065));
      g.add(mesh(rbox(0.035, 0.11, 0.02, 0.008), M.paper, -0.15, 0.03, 0.065));
      [0x4f7cac, 0xb5523b, 0xc9a227, 0x3f8f7a].forEach((col, k) => {
        const a = (k / 4) * Math.PI * 2;
        g.add(mesh(track(new THREE.SphereGeometry(0.022, 10, 8)), clay(col), 0.15 + Math.cos(a) * 0.045, 0.03 + Math.sin(a) * 0.045, 0.065));
      });
    },
    // 4: film clapperboard
    (g) => {
      g.add(mesh(rbox(0.52, 0.32, 0.04, 0.02), M.chairDark, 0, -0.04, 0));
      for (const y of [-0.02, -0.08, -0.14]) g.add(mesh(rbox(0.38, 0.018, 0.044, 0.005), M.paper, 0, y, 0));
      const arm = new THREE.Group();
      arm.add(mesh(rbox(0.54, 0.07, 0.05, 0.015), M.chairDark, 0.27, 0, 0));
      for (const x of [0.1, 0.27, 0.44]) arm.add(mesh(rbox(0.08, 0.072, 0.052, 0.005), M.paper, x, 0, 0));
      arm.position.set(-0.26, 0.17, 0);
      arm.rotation.z = 0.22;
      g.add(arm);
    },
    // 5: sketchpad and pencil
    (g) => {
      const pad = mesh(rbox(0.44, 0.54, 0.025, 0.01), M.paper, 0, 0.07, -0.02);
      pad.rotation.x = -0.12;
      g.add(pad);
      const curve = mesh(track(new THREE.TorusGeometry(0.1, 0.009, 6, 28, 4.8)), clay(0x4f7cac), -0.02, 0.14, 0.012);
      g.add(curve);
      const curve2 = mesh(track(new THREE.TorusGeometry(0.05, 0.008, 6, 20, 4.2)), clay(0xb5523b), 0.09, 0.0, 0.0);
      g.add(curve2);
      const pencil = new THREE.Group();
      pencil.add(mesh(track(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10)), clay(0xc9a227)));
      const tip = mesh(track(new THREE.ConeGeometry(0.022, 0.06, 10)), M.chairDark, 0, -0.21, 0);
      tip.rotation.x = Math.PI;
      pencil.add(tip);
      pencil.position.set(0.1, -0.03, 0.06);
      pencil.rotation.z = -0.85;
      g.add(pencil);
    },
    // 6: potted plant
    (g) => {
      g.add(mesh(track(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 16)), M.pot, 0, -0.06, 0));
      for (let k = 0; k < 6; k++) {
        const leaf = mesh(track(new THREE.SphereGeometry(0.13, 10, 8)), M.plant);
        const a = (k / 6) * Math.PI * 2;
        leaf.scale.set(0.6, 1.4, 0.25);
        leaf.position.set(Math.cos(a) * 0.12, 0.28 + (k % 2) * 0.08, Math.sin(a) * 0.12);
        leaf.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        g.add(leaf);
      }
    },
  ];
  const shelfItems: THREE.Object3D[] = [];
  builders.forEach((build, i) => {
    const g = new THREE.Group();
    build(g);
    g.position.copy(cubby(i));
    shelf.add(g);
    if (!SHELF_LABELS[i]) return;
    g.userData.label = SHELF_LABELS[i];
    g.userData.base = g.position.y;
    g.userData.hover = 0;
    shelfItems.push(g);
  });


  let hovered: THREE.Object3D | null = null;
  let lastBlink = 0;
  let lastTopic = 0;

  return {
    root,
    shelfItems,
    lamp: {
      hit: [grabCord, grabKnob],
      setCord,
      setHot(hot) {
        knobMat.emissiveIntensity = hot ? 0.8 : 0;
        knob.scale.setScalar(hot ? 1.25 : 1);
      },
      setLit(on) {
        lampLight.intensity = on ? 16 : 0;
        shadeMat.emissiveIntensity = on ? 0.95 : 0;
        bulbMat.color.set(on ? 0xfff0d2 : 0xb9bdc4);
        wallGlow.visible = floorGlow.visible = on;
      },
      knobPosition: (out) => knob.getWorldPosition(out),
    },
    screen,
    person: person.group,
    animate(t) {
      person.animate(t);
      if (!reduceMotion) steamMat.uniforms.time.value = t;
      // the laptop moves on to its next topic every few seconds
      const topic = Math.floor(t / 3.2) % AWS_TOPICS.length;
      if (topic !== lastTopic) {
        lastTopic = topic;
        drawLaptop(topic);
      }
      if (t - lastBlink > 0.55) {
        lastBlink = t;
        drawScreen(Math.floor(t / 0.55) % 2 === 0);
      }
      for (const it of shelfItems) {
        const target = it === hovered ? 1 : 0;
        it.userData.hover += (target - it.userData.hover) * 0.15;
        const h = it.userData.hover;
        it.scale.setScalar(1 + h * 0.18);
        it.position.y = it.userData.base + h * 0.08;
        it.rotation.y = h * Math.sin(t * 3) * 0.35;
      }
    },
    setHovered(item) {
      hovered = item;
    },
    setTheme(light) {
      screenLight = light;
      // white steam would vanish against the light theme, so it turns a soft grey there
      steamMat.uniforms.tint.value.set(light ? 0x7f8a9a : 0xfff4e6);
      steamMat.uniforms.strength.value = light ? 0.3 : 0.42;
      drawScreen(true);
    },
  };
}
