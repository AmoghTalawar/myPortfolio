/* The 5G project's system diagram, played live: a request climbs from a phone through the radio
   and core to the scheduler, which sends it to the edge, the cloud, or back to the phone. */
import { animate, inView } from "motion";
import { $, $$, reducedMotion } from "../core/dom";

type PathName = "edge" | "cloud" | "local";
type Pt = [number, number];

const NS = "http://www.w3.org/2000/svg";
const ORDER: PathName[] = ["edge", "cloud", "local"];
const SUMMARY: Record<PathName, string> = {
  edge: "The scheduler keeps the task at the edge, where a Kubernetes node classifies the image and results go to cloud storage.",
  cloud: "When edge nodes are over their limits, the task goes to the OpenStack cloud node, and results go to storage.",
  local: "With local offloading, the task returns to the phone and runs there.",
};

export function initOffloadDemo() {
  const root = $("#offload-demo");
  const stage = $(".arch-stage", root ?? document);
  if (!root || !stage) return;

  const reduce = reducedMotion();
  const caption = $(".arch-caption", root)!;
  const tabs = $$<HTMLButtonElement>(".arch-tab", root);
  const node = (n: string) => $(`[data-n="${n}"]`, stage)!;

  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("arch-lines");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<defs><marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 8 4 0 8Z" fill="currentColor"/></marker></defs>`;
  const baseLayer = document.createElementNS(NS, "g");
  const trailLayer = document.createElementNS(NS, "g");
  svg.append(baseLayer, trailLayer);
  const dots = document.createElement("div");
  dots.className = "arch-dots";
  dots.setAttribute("aria-hidden", "true");
  stage.prepend(svg);
  stage.append(dots);

  /* ---------- geometry ---------- */
  const box = (n: string) => {
    const s = stage.getBoundingClientRect();
    const r = node(n).getBoundingClientRect();
    const left = r.left - s.left;
    const top = r.top - s.top;
    return { left, top, right: left + r.width, bottom: top + r.height, cx: left + r.width / 2, cy: top + r.height / 2 };
  };
  const line = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");

  /** from the top of one node up to the bottom of another, with one bend if they don't line up */
  const up = (a: string, b: string) => {
    const f = box(a);
    const t = box(b);
    if (Math.abs(f.cx - t.cx) < 2) return line([[f.cx, f.top], [f.cx, t.bottom]]);
    const mid = (f.top + t.bottom) / 2;
    return line([[f.cx, f.top], [f.cx, mid], [t.cx, mid], [t.cx, t.bottom]]);
  };

  const routes = () => {
    const w = stage.offsetWidth;
    const gutter = Math.min(14, w * 0.03);
    const sched = box("sched");
    const cloud = box("cloud");
    const node1 = box("node");
    const store = box("store");
    const m3 = box("m3");
    return {
      m1: up("m1", "tower"),
      m2: up("m2", "tower"),
      m3: up("m3", "tower"),
      tower: up("tower", "ran"),
      ran: up("ran", "core"),
      core: up("core", "sched"),
      intel: up("sched", "intel"),
      e1: up("intel", "e1"),
      e2: up("intel", "e2"),
      e3: up("intel", "e3"),
      edgeUp: up("edge", "cloud"),
      internet: up("cloud", "internet"),
      store1: up("e1", "store"),
      store2: up("e2", "store"),
      store3: up("e3", "store"),
      nodeStore: line([[node1.right, node1.cy], [store.left, store.cy]]),
      offCloud: line([[sched.left, sched.cy], [gutter, sched.cy], [gutter, node1.cy], [cloud.left, node1.cy], [node1.left, node1.cy]]),
      offLocal: line([[sched.right, sched.cy], [w - gutter, sched.cy], [w - gutter, m3.cy], [m3.right, m3.cy]]),
    };
  };

  const STATIC: { key: keyof ReturnType<typeof routes>; dashed?: boolean }[] = [
    { key: "m1" }, { key: "m2" }, { key: "m3" }, { key: "tower" }, { key: "ran" }, { key: "core" },
    { key: "intel" }, { key: "e1" }, { key: "e2" }, { key: "e3" }, { key: "edgeUp" }, { key: "internet" },
    { key: "offCloud", dashed: true }, { key: "offLocal", dashed: true },
  ];

  function drawBase() {
    svg.setAttribute("width", String(stage!.offsetWidth));
    svg.setAttribute("height", String(stage!.offsetHeight));
    const r = routes();
    baseLayer.replaceChildren();
    STATIC.forEach(({ key, dashed }) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", r[key]);
      p.setAttribute("class", dashed ? "arch-line is-dashed" : "arch-line");
      p.setAttribute("marker-end", "url(#arch-arrow)");
      baseLayer.appendChild(p);
    });
    const s = box("sched");
    $(".arch-off-cloud", stage!)!.style.top = `${s.cy}px`;
    $(".arch-off-local", stage!)!.style.top = `${s.cy}px`;
  }

  /* ---------- what each path does, hop by hop ---------- */
  function plan(path: PathName) {
    const r = routes();
    if (path === "edge") {
      const n = String(1 + Math.floor(Math.random() * 3));
      return [
        { d: r.m1, hit: "tower", text: "A phone sends an image over the private 5G radio." },
        { d: r.tower, hit: "ran", text: "The radio tower passes it to the srsRAN base station." },
        { d: r.ran, hit: "core", text: "The Open5GS core carries it through the UPF." },
        { d: r.core, hit: "sched", text: "The task offloading scheduler decides where it should run." },
        { d: r.intel, hit: "intel", text: "It stays at the edge, and the intelligent scheduler picks the best node." },
        { d: r[`e${n}` as "e1"], hit: `e${n}`, text: "The Kubernetes edge node classifies the image." },
        { d: r[`store${n}` as "store1"], hit: "store", text: "Results go to cloud storage for future retraining." },
      ];
    }
    if (path === "cloud") {
      return [
        { d: r.m2, hit: "tower", text: "A phone sends an image over the private 5G radio." },
        { d: r.tower, hit: "ran", text: "The radio tower passes it to the srsRAN base station." },
        { d: r.ran, hit: "core", text: "The Open5GS core carries it through the UPF." },
        { d: r.core, hit: "sched", text: "The task offloading scheduler decides where it should run." },
        { d: r.offCloud, hit: "node", text: "Edge nodes are over their limits, so it is offloaded to the cloud.", slow: true },
        { d: r.nodeStore, hit: "store", text: "The OpenStack node runs it, and results go to storage." },
      ];
    }
    return [
      { d: r.m3, hit: "tower", text: "A phone sends an image over the private 5G radio." },
      { d: r.tower, hit: "ran", text: "The radio tower passes it to the srsRAN base station." },
      { d: r.ran, hit: "core", text: "The Open5GS core carries it through the UPF." },
      { d: r.core, hit: "sched", text: "The task offloading scheduler decides where it should run." },
      { d: r.offLocal, hit: "m3", text: "With local offloading, the task returns to the phone and runs there.", slow: true },
    ];
  }

  const setPath = (path: PathName) => {
    stage.dataset.path = path;
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.path === path)));
  };

  const clearRun = () => {
    trailLayer.replaceChildren();
    dots.replaceChildren();
    $$(".is-hit", stage).forEach((el) => el.classList.remove("is-hit"));
  };

  const addTrail = (d: string) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("pathLength", "1");
    p.setAttribute("class", "arch-trail");
    trailLayer.appendChild(p);
    return p;
  };

  /* ---------- the loop ---------- */
  let run = 0;
  const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

  async function play(start: PathName) {
    const mine = ++run;
    let path = start;
    while (mine === run) {
      setPath(path);
      clearRun();
      for (const hop of plan(path)) {
        if (mine !== run) return;
        caption.textContent = hop.text;
        const duration = hop.slow ? 1.1 : 0.7;
        const trail = addTrail(hop.d);
        animate(trail, { strokeDashoffset: [1, 0] }, { duration, ease: "easeInOut" });
        const dot = document.createElement("span");
        dot.className = "arch-dot";
        dot.style.offsetPath = `path("${hop.d}")`;
        dots.appendChild(dot);
        await animate(dot, { offsetDistance: ["0%", "100%"], opacity: [1, 1] }, { duration, ease: "easeInOut" }).finished;
        if (mine !== run) return;
        dot.remove();
        const el = node(hop.hit);
        el.classList.add("is-hit");
        animate(el, { scale: [1, 1.07, 1] }, { duration: 0.35 });
        await wait(0.65);
      }
      await wait(1.8);
      path = ORDER[(ORDER.indexOf(path) + 1) % ORDER.length];
    }
  }

  /** with animations off, picking a path simply shows it complete */
  function showStatic(path: PathName) {
    setPath(path);
    clearRun();
    plan(path).forEach((hop) => {
      addTrail(hop.d).style.strokeDashoffset = "0";
      node(hop.hit).classList.add("is-hit");
    });
    caption.textContent = SUMMARY[path];
  }

  let current: PathName = "edge";
  let onScreen = false;
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      current = t.dataset.path as PathName;
      if (reduce) return showStatic(current);
      // on small screens the buttons can be in view before the diagram is, so always answer the choice
      setPath(current);
      caption.textContent = SUMMARY[current];
      if (onScreen) play(current);
    });
  });

  drawBase();
  if (reduce) showStatic(current);
  else {
    setPath(current);
    inView(stage, () => {
      onScreen = true;
      drawBase();
      setTimeout(() => {
        if (onScreen) play(current);
      }, 900);
      return () => {
        onScreen = false;
        run++;
        clearRun();
      };
    }, { amount: 0.15 });
  }

  // keep the wiring lined up whenever the card changes size
  let timer = 0;
  new ResizeObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      drawBase();
      if (reduce) showStatic(current);
      else if (onScreen) play((stage.dataset.path as PathName) ?? current);
    }, 150);
  }).observe(stage);
  document.fonts?.ready.then(drawBase);
}
