/* Custom cursor: a comet. An arrow tracks the pointer exactly and tilts into its movement, while a
   tapered ribbon trails behind it. Links make it pulse, and clicks throw off a ring and sparks. */
import { $ } from "../core/dom";
import { sfx } from "../audio/sound";

const INTERACTIVE = "a, button, label, [role='option'], .proj, .chip, input, textarea, summary";
const NODES = 22; // points along the ribbon
const RIBBON_WIDTH = 7; // at its thickest, in px
const FOLLOW_TIME = 0.03; // seconds each point takes to catch the one ahead of it
const MAX_TILT = 24; // degrees
const SPARK_LIFE = 0.5; // seconds

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

export function initCursor() {
  const fine = matchMedia("(pointer: fine)").matches;
  const root = $(".cursor");
  if (!fine || !root) return;
  document.documentElement.classList.add("has-cursor");
  const head = $(".cursor-head", root)!;
  const canvas = $<HTMLCanvasElement>(".cursor-trail", root)!;
  const ctx = canvas.getContext("2d")!;
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let x = -100, y = -100, tilt = 0, speedX = 0;
  let raf = 0, last = 0;
  const nodes = Array.from({ length: NODES }, () => ({ x: -100, y: -100 }));
  const sparks: Spark[] = [];
  const rings: { x: number; y: number; age: number }[] = [];
  let rgb = "0, 0, 0";

  // the accent colour as "r, g, b", so the ribbon can fade it out; follows the theme
  const readColour = () => {
    ctx.fillStyle = getComputedStyle(root).getPropertyValue("--b").trim() || "#000";
    const c = String(ctx.fillStyle);
    if (c.startsWith("#")) rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(", ");
    else rgb = c.replace(/^rgba?\(|\)$/g, "").split(",").slice(0, 3).join(",");
  };
  new MutationObserver(readColour).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readColour();
  };
  addEventListener("resize", resize, { passive: true });
  resize();

  const placeHead = () => {
    head.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg)`;
  };

  function drawRibbon() {
    const tail = nodes[NODES - 1];
    if (Math.hypot(x - tail.x, y - tail.y) < 3) return;
    const left: [number, number][] = [], right: [number, number][] = [];
    for (let i = 0; i < NODES; i++) {
      const a = nodes[Math.max(i - 1, 0)], b = nodes[Math.min(i + 1, NODES - 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const w = (RIBBON_WIDTH / 2) * (1 - i / (NODES - 1)) ** 1.3;
      left.push([nodes[i].x - (dy / len) * w, nodes[i].y + (dx / len) * w]);
      right.push([nodes[i].x + (dy / len) * w, nodes[i].y - (dx / len) * w]);
    }
    const fade = ctx.createLinearGradient(x, y, tail.x, tail.y);
    fade.addColorStop(0, `rgba(${rgb}, 0.85)`);
    fade.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = fade;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const [px, py] of left) ctx.lineTo(px, py);
    for (let i = NODES - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function drawClicks(dt: number) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.age += dt;
      const k = r.age / SPARK_LIFE;
      if (k >= 1) {
        rings.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(${rgb}, ${(1 - k) * 0.7})`;
      ctx.lineWidth = 2 * (1 - k) + 0.3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + (1 - (1 - k) ** 3) * 34, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      const k = s.age / SPARK_LIFE;
      if (k >= 1) {
        sparks.splice(i, 1);
        continue;
      }
      s.vx *= Math.exp(-dt * 5);
      s.vy = s.vy * Math.exp(-dt * 5) + 240 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      ctx.fillStyle = `rgba(${rgb}, ${1 - k})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.4 * (1 - k) + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000 || 1 / 60, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt / FOLLOW_TIME);
    nodes[0].x = x;
    nodes[0].y = y;
    for (let i = 1; i < NODES; i++) {
      nodes[i].x += (nodes[i - 1].x - nodes[i].x) * k;
      nodes[i].y += (nodes[i - 1].y - nodes[i].y) * k;
    }
    // lean into sideways movement, then settle back upright
    speedX *= Math.exp(-dt * 9);
    tilt += (Math.max(-MAX_TILT, Math.min(MAX_TILT, speedX * 0.035)) - tilt) * (1 - Math.exp(-dt * 16));
    placeHead();

    ctx.clearRect(0, 0, innerWidth, innerHeight);
    drawRibbon();
    drawClicks(dt);

    const tail = nodes[NODES - 1];
    const busy = Math.hypot(x - tail.x, y - tail.y) > 0.5 || Math.abs(tilt) > 0.1 || sparks.length > 0 || rings.length > 0;
    if (busy) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  let moved = false;
  let lastMove = 0;
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (moved && now > lastMove) speedX = ((e.clientX - x) / (now - lastMove)) * 1000;
      lastMove = now;
      x = e.clientX;
      y = e.clientY;
      root.classList.remove("is-hidden");
      if (!moved) {
        // the first move starts the ribbon at the pointer, not sweeping in from off-screen
        moved = true;
        for (const n of nodes) {
          n.x = x;
          n.y = y;
        }
      }
      if (still.matches) {
        placeHead();
        return;
      }
      wake();
    },
    { passive: true },
  );

  let lastHover: Element | null = null;
  addEventListener("pointerover", (e) => {
    const el = (e.target as Element).closest?.(INTERACTIVE) ?? null;
    root.classList.toggle("is-hover", !!el);
    if (el && el !== lastHover && el.matches("a, button")) sfx.tick();
    lastHover = el;
  });
  addEventListener("pointerdown", () => {
    root.classList.add("is-down");
    if (still.matches) return;
    rings.push({ x, y, age: 0 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const v = 130 + Math.random() * 170;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0 });
    }
    wake();
  });
  addEventListener("pointerup", () => root.classList.remove("is-down"));
  document.addEventListener("pointerleave", () => root.classList.add("is-hidden"));
  addEventListener("blur", () => root.classList.add("is-hidden"));
}
