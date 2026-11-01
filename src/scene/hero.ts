/* Hero 3D: the clay workstation rendered into an in-page canvas with a transparent background,
   so the topography shows through. Lazy-loaded; pauses whenever it is off screen. */
import * as THREE from "three";
import { buildDeskScene } from "./character";

export interface HeroOptions {
  colors: { a: string; b: string };
  light: boolean;
  onShelfHover?: (label: string | null, x: number, y: number) => void;
  /** the lamp cord was pulled; x and y are the knob's position on screen */
  onLampPull?: (x: number, y: number) => void;
}

export interface Hero {
  setColors(a: string, b: string, light: boolean): void;
  /** 0 = desk at rest, 1 = camera inside the monitor (screen fills the canvas) */
  setScroll(k: number): void;
  setPaused(p: boolean): void;
}

export function createHero(canvas: HTMLCanvasElement, opts: HeroOptions): Hero {
  const small = Math.min(innerWidth, innerHeight) < 700;
  const dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const colA = new THREE.Color(opts.colors.a);
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const desk = buildDeskScene({ accent: colA, track, shadows: true });
  desk.root.rotation.y = -0.18;
  scene.add(desk.root);

  // soft contact shadow on an invisible floor
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 10)), track(new THREE.ShadowMaterial({ opacity: 0.14 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.56;
  floor.receiveShadow = true;
  scene.add(floor);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 2.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -4, near: 1, far: 20 });
  key.shadow.bias = -0.0012;
  key.shadow.radius = 5;
  scene.add(key);
  const glow = new THREE.PointLight(colA, 1, 5, 1.6);
  glow.position.set(0, 0.2, -0.6);
  scene.add(glow);

  // ---------- framing ----------
  const center = new THREE.Vector3(0, 0.25, 0);
  const restPos = new THREE.Vector3();
  const monitor = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const divePos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let scrollK = 0;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();

  function frame() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit a 5.8 × 4.6 box (shelf top to chair base, desk width) inside the view
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = 2.9 / Math.tan(vFov / 2);
    // wider than the desk so the floor lamp stays in view on narrow screens
    const distW = 3.15 / (Math.tan(vFov / 2) * camera.aspect);
    restPos.set(0, 1.4, Math.max(distH, distW) + 1.2);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(frame).observe(canvas);
  frame();

  // ---------- interaction ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: THREE.Object3D | null = null;
  const LAMP_TIP = "Pull the cord to switch theme";
  const PULL_FIRES_AT = 0.62;
  const SPRING_STEP = 1 / 120;
  let lampHot = false;
  let dragging = false;
  let dragStartY = 0;
  let dragMoved = false;
  let dragTarget = 0;
  let firedThisPull = false;
  let tapPulling = false;
  let pull = 0, pullV = 0, sway = 0, swayV = 0;
  const knobOnScreen = new THREE.Vector3();

  const pointAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const overCord = () => raycaster.intersectObjects(desk.lamp.hit, false).length > 0;

  function fireLamp() {
    desk.lamp.knobPosition(knobOnScreen).project(camera);
    const r = canvas.getBoundingClientRect();
    opts.onLampPull?.(r.left + ((knobOnScreen.x + 1) / 2) * r.width, r.top + ((1 - knobOnScreen.y) / 2) * r.height);
  }

  function endPull() {
    if (!dragging) return;
    dragging = false;
    // a press with no drag still pulls the cord, for tapping on a phone
    if (!dragMoved) tapPulling = true;
    swayV += 2.4;
  }
  canvas.addEventListener("pointerdown", (e) => {
    pointAt(e);
    if (!overCord()) return;
    e.preventDefault();
    dragging = true;
    dragStartY = e.clientY;
    dragMoved = false;
    dragTarget = 0;
    firedThisPull = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", endPull);
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });

  canvas.addEventListener("pointermove", (e) => {
    pointAt(e);
    pointer.copy(ndc);
    if (dragging) {
      const dy = e.clientY - dragStartY;
      if (Math.abs(dy) > 4) dragMoved = true;
      // how far one screen pixel is at the lamp's distance, so the knob follows the pointer
      const unitsPerPx = (2 * camera.position.distanceTo(center) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / (canvas.clientHeight || 1);
      dragTarget = Math.max(0, Math.min(1.1, (dy * unitsPerPx) / 0.36));
      return;
    }
    const nowHot = overCord();
    if (nowHot !== lampHot) {
      lampHot = nowHot;
      desk.lamp.setHot(nowHot);
    }
    if (nowHot) {
      if (hovered) {
        hovered = null;
        desk.setHovered(null);
      }
      canvas.style.cursor = "grab";
      opts.onShelfHover?.(LAMP_TIP, e.clientX, e.clientY);
      return;
    }
    const hit = raycaster.intersectObjects(desk.shelfItems, true)[0];
    let item: THREE.Object3D | null = hit ? hit.object : null;
    while (item && !desk.shelfItems.includes(item)) item = item.parent;
    const changed = item !== hovered;
    if (changed) {
      hovered = item;
      desk.setHovered(item);
      canvas.style.cursor = item ? "pointer" : "";
    }
    if (!item && !changed && canvas.style.cursor === "grab") {
      canvas.style.cursor = "";
      opts.onShelfHover?.(null, 0, 0);
    }
    if (item || changed) opts.onShelfHover?.(item ? item.userData.label : null, e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.set(0, 0);
    if (lampHot) {
      lampHot = false;
      desk.lamp.setHot(false);
      canvas.style.cursor = "";
      opts.onShelfHover?.(null, 0, 0);
    }
    if (hovered) {
      hovered = null;
      desk.setHovered(null);
      opts.onShelfHover?.(null, 0, 0);
    }
  });

  // ---------- loop (only while visible) ----------
  const clock = new THREE.Clock();
  let raf = 0, onScreen = true, paused = false, running = false;
  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 4));
    desk.animate(t);
    // the cord springs back after a pull and keeps swinging for a moment
    const pullTarget = dragging ? dragTarget : tapPulling ? 1 : 0;
    // in small fixed steps: one big step on a slow device makes the spring overshoot and fire again and again
    for (let left = dt; left > 0; left -= SPRING_STEP) {
      const h = Math.min(left, SPRING_STEP);
      pullV += ((pullTarget - pull) * 190 - pullV * 17) * h;
      pull += pullV * h;
      if (pull < 0) {
        pull = 0;
        pullV = 0;
      }
      swayV += (-sway * 70 - swayV * 2.6) * h;
      sway += swayV * h;
    }
    desk.lamp.setCord(pull, sway * 0.09);
    if (pull >= PULL_FIRES_AT && !firedThisPull) {
      firedThisPull = true;
      tapPulling = false;
      swayV += 1.6;
      fireLamp();
    }
    if (tapPulling && pull < 0.01 && firedThisPull) tapPulling = false;
    if (!dragging && !tapPulling && pull < PULL_FIRES_AT * 0.5) firedThisPull = false;
    desk.screen.getWorldPosition(monitor);
    desk.screen.getWorldDirection(normal);
    // dive: from the resting view straight into the monitor until its screen fills the canvas
    const k = scrollK * scrollK * (3 - 2 * scrollK);
    const calm = 1 - Math.min(1, k * 3); // parallax fades out as the dive starts
    camera.position.set(restPos.x + pointerSmooth.x * 0.9 * calm, restPos.y + pointerSmooth.y * 0.5 * calm, restPos.z);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    // distance at which the 1.86 × 1.1 screen covers the view (slightly overscanned)
    const fill = Math.min(0.55 / tanH, 0.93 / (tanH * camera.aspect)) * 0.94;
    divePos.copy(monitor).addScaledVector(normal, fill);
    camera.position.lerp(divePos, k);
    camera.position.y += Math.sin(Math.PI * k) * 1.1; // arc over the character's head
    desk.person.visible = k < 0.82;
    look.copy(center).lerp(monitor, Math.min(1, k * 1.4));
    camera.lookAt(look);
    renderer.render(scene, camera);
  }
  function update() {
    const want = onScreen && !paused && !document.hidden;
    if (want && !running) {
      running = true;
      clock.getDelta();
      loop();
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    update();
  }).observe(canvas);
  document.addEventListener("visibilitychange", update);

  function applyLight(light: boolean) {
    // in the black theme the lamp is the room's light, so everything takes on its warmth
    hemi.intensity = light ? 2.2 : 0.95;
    hemi.color.set(light ? 0xffffff : 0xffdfba);
    hemi.groundColor.set(light ? 0x9aa3b2 : 0x4a3524);
    key.intensity = light ? 2.4 : 0.8;
    key.color.set(light ? 0xffffff : 0xffdcb4);
    glow.intensity = light ? 1 : 1.2;
    (floor.material as THREE.ShadowMaterial).opacity = light ? 0.14 : 0.35;
    desk.setTheme(light, colA);
    desk.lamp.setLit(!light);
  }
  applyLight(opts.light);
  update();

  return {
    setColors(a, _b, light) {
      colA.set(a);
      applyLight(light);
    },
    setScroll(k) {
      scrollK = Math.max(0, Math.min(1, k));
    },
    setPaused(p) {
      paused = p;
      update();
    },
  };
}
