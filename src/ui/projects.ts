/* Projects: category filters, and small responses shared by the section's buttons.
   The project modules themselves live in project-board.ts. */
import { animate, press } from "motion";
import { $, $$, reducedMotion } from "../core/dom";
import { sfx } from "../audio/sound";
import { initProjectBoard } from "./project-board";
import { initOffloadDemo } from "./offload-demo";
import { initBrainDemo } from "./brain-demo";

const LABELS: Record<string, string> = {
  all: "",
  ai: "AI / ML",
  net: "Networking",
  agents: "Agents",
  edge: "Edge & Systems",
};

const spring = (bounce = 0) => (reducedMotion() ? { duration: 0 } : ({ type: "spring", visualDuration: 0.42, bounce } as const));

/** the dark indicator slides between filter buttons, the vanilla form of a shared layout */
function initFilterIndicator(bar: HTMLElement) {
  const pill = document.createElement("span");
  pill.className = "filter-pill";
  pill.setAttribute("aria-hidden", "true");
  bar.prepend(pill);
  bar.classList.add("has-pill");

  const moveTo = (b: HTMLElement, instant = false) => {
    animate(
      pill,
      { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight },
      instant ? { duration: 0 } : spring(0.18),
    );
  };
  const snap = () => {
    const on = $(".filter.on", bar);
    if (on) moveTo(on, true);
  };
  snap();
  document.fonts?.ready.then(snap);
  addEventListener("resize", snap, { passive: true });
  return moveTo;
}

export function initProjects(opts: { lockScroll: (on: boolean) => void }) {
  const bar = $("#filters");
  const count = $("#proj-count");
  const cards = $$("#arc-stage .proj");
  if (!bar || !count) return;

  const paper = $("#arc-stage .proj-pub");
  const projectBoard = initProjectBoard(opts);
  initOffloadDemo();
  initBrainDemo();
  // the 5G card's button opens the details and starts the video inside them
  const demo = $<HTMLVideoElement>("#testbed-demo");
  const testbed = demo?.closest<HTMLElement>(".proj");
  $("#testbed-watch")?.addEventListener("click", () => {
    if (!demo || !testbed) return;
    $<HTMLButtonElement>(".mod-open", testbed)?.click();
    demo.play().catch(() => {});
  });
  const moveIndicator = initFilterIndicator(bar);
  const matches = (c: HTMLElement, f: string) => f === "all" || c.dataset.cat!.split(" ").includes(f);

  const report = (f: string) => {
    const n = cards.filter((c) => matches(c, f)).length;
    count.textContent = f === "all" ? `Showing all ${n} projects` : `${n} ${n === 1 ? "project" : "projects"} in ${LABELS[f]}`;
  };

  bar.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".filter");
    if (!b) return;
    $$<HTMLButtonElement>(".filter", bar).forEach((x) => {
      const on = x === b;
      x.classList.toggle("on", on);
      x.setAttribute("aria-pressed", String(on));
    });
    const f = b.dataset.f!;
    moveIndicator(b);
    // the paper keeps its look: it simply shows or hides
    if (paper) paper.classList.toggle("hide", !matches(paper, f));
    projectBoard?.applyFilter((c) => matches(c, f), f === "all");
    report(f);
    sfx.blip();
  });
  report("all");

  // buttons give a small press response, except on the paper, which stays as it is
  $$(".btn").filter((b) => !b.closest(".proj-pub")).forEach((b) => {
    press(b, () => {
      animate(b, { scale: 0.96 }, spring());
      return () => animate(b, { scale: 1 }, spring(0.45));
    });
  });

  // write the Kannada word out once, the first time the paper scrolls into view
  const word = $("#pub-word");
  if (word) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        word.classList.add("is-written");
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    // watch the page, not the word: a fully clipped element never reports as intersecting
    io.observe(word.parentElement!);
  }
}
