/* The ADHD project's brain: tabs change what is highlighted, and choosing a region explains it.
   The drawing illustrates the ideas behind the project; it is not output from the model. */
import { $, $$, reducedMotion } from "../core/dom";

const NS = "http://www.w3.org/2000/svg";

const VIEWS: Record<string, { text: string; on: string[] }> = {
  regions: {
    text: "Six brain regions and networks often studied in ADHD research. Select one to see what it does.",
    on: ["pfc", "dmn", "str", "amy", "hip", "cbl"],
  },
  connectome: {
    text: "The connectome data maps 200 brain regions. Every pair is one connection, giving 19,900 features per person, which PCA reduced to 150.",
    on: [],
  },
  adhd: {
    text: "Attention and impulse control involve the prefrontal cortex, default mode network and striatum, which are central to ADHD research.",
    on: ["pfc", "dmn", "str"],
  },
  sex: {
    text: "ADHD can look different across sexes, and girls are often underdiagnosed. This project's analysis pointed to distinct default mode network connectivity in girls.",
    on: ["dmn"],
  },
};

const REGIONS: Record<string, string> = {
  pfc: "Prefrontal cortex: the executive control centre for attention, working memory and impulse control.",
  dmn: "Default mode network: active during self-referential thought and introspection. It links the front, middle and back of the brain.",
  str: "Striatum: part of the reward and motor control systems, linked to hyperactivity and impulsivity.",
  amy: "Amygdala: processes emotion, and is linked to the emotional dysregulation often seen with ADHD.",
  hip: "Hippocampus: supports memory formation and spatial navigation.",
  cbl: "Cerebellum: known for motor control, and also contributes to cognition and attention regulation.",
};

export function initBrainDemo() {
  const root = $("#brain-demo");
  const stage = $(".brain-stage", root ?? document);
  if (!root || !stage) return;

  const caption = $(".arch-caption", root)!;
  const tabs = $$<HTMLButtonElement>(".arch-tab", root);
  const legend = $$<HTMLButtonElement>(".brain-legend button", stage);
  const shapes = $$(".br-region", stage);
  let view = "regions";
  let pinned: string | null = null;
  let meshBuilt = false;

  /** 200 dots, one for each region in the data; their positions are decorative */
  function buildMesh() {
    if (meshBuilt) return;
    meshBuilt = true;
    const outline = $<SVGGeometryElement>("#brain-outline", stage!);
    const layer = $(".br-mesh", stage!);
    if (!outline || !layer) return;
    const svg = outline.ownerSVGElement!;
    // a fixed seed, so the pattern is the same on every visit
    let seed = 42;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts: [number, number][] = [];
    const p = svg.createSVGPoint();
    for (let guard = 0; pts.length < 200 && guard < 8000; guard++) {
      p.x = 100 + rand() * 470;
      p.y = 35 + rand() * 330;
      if (outline.isPointInFill(p) && pts.every((q) => Math.hypot(q[0] - p.x, q[1] - p.y) > 15)) pts.push([p.x, p.y]);
    }
    let lines = "";
    pts.forEach((a, i) => {
      // mostly nearby links, plus a few long ones across the brain
      pts.forEach((b, j) => {
        if (j <= i) return;
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if ((d < 34 && rand() < 0.55) || (d > 170 && rand() < 0.006)) lines += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
      });
    });
    const links = document.createElementNS(NS, "path");
    links.setAttribute("d", lines);
    links.classList.add("br-mesh-lines");
    const dots = document.createElementNS(NS, "path");
    dots.setAttribute("d", pts.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)}h.01`).join(""));
    dots.classList.add("br-mesh-dots");
    layer.append(links, dots);
  }

  function paint(shown: string | null) {
    const lit = shown ? [shown] : VIEWS[view].on;
    shapes.forEach((s) => s.classList.toggle("is-on", lit.includes(s.dataset.r!)));
    stage!.classList.toggle("has-focus", Boolean(shown));
    caption.textContent = shown ? REGIONS[shown] : VIEWS[view].text;
  }

  function pin(r: string | null) {
    pinned = r;
    legend.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.r === r)));
    paint(r);
  }

  function setView(next: string) {
    view = next;
    if (next === "connectome") buildMesh();
    stage!.dataset.view = next;
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.view === next)));
    pin(null);
  }

  tabs.forEach((t) => t.addEventListener("click", () => setView(t.dataset.view!)));

  const choose = (r: string) => {
    // regions are hidden in the connectome view, so choosing one returns to them
    if (view === "connectome") setView("regions");
    pin(pinned === r ? null : r);
  };
  const preview = (el: HTMLElement) => {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse" && view !== "connectome") paint(el.dataset.r!);
    });
    el.addEventListener("pointerleave", () => paint(pinned));
    el.addEventListener("click", () => choose(el.dataset.r!));
  };
  legend.forEach(preview);
  shapes.forEach(preview);

  // the signals only run while the brain is on screen
  const svg = $<SVGSVGElement>(".brain-svg", stage);
  if (reducedMotion()) svg?.pauseAnimations();
  else {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) svg?.unpauseAnimations();
      else svg?.pauseAnimations();
    }).observe(stage);
  }
  paint(null);
}
