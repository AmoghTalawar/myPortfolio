/* Project diagrams animate once, when scrolled to, to show how each system works:
   a request travels through the stages, traffic crosses the backbone, role access narrows. */
import { animate, hover, inView, stagger } from "motion";
import { $, $$, reducedMotion } from "../core/dom";

const SIGNAL = "#ffb703";
const INK = "#0d3b47";
const OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const isWide = () => matchMedia("(min-width: 901px)").matches;

function makeDot(parent: HTMLElement) {
  const dot = document.createElement("span");
  dot.className = "flow-dot";
  dot.setAttribute("aria-hidden", "true");
  parent.appendChild(dot);
  return dot;
}

/** stages appear in order, then a signal runs through them, lighting each one as it passes */
function traceFlow(list: HTMLElement) {
  inView(list, () => {
    const items = $$(":scope > li", list);
    animate(items, { opacity: [0, 1], y: [10, 0] }, { duration: 0.45, ease: OUT, delay: stagger(0.07) });
    if (!isWide()) return;

    // layout offsets, not screen rects: the detail view may still be scaling at this point
    const tiles = $$(".flow-ic", list);
    const first = tiles[0];
    const dot = makeDot(list);
    dot.style.left = `${items[0].offsetLeft + first.offsetLeft + first.offsetWidth / 2 - 6}px`;
    dot.style.top = `${items[0].offsetTop + first.offsetTop + first.offsetHeight / 2 - 6}px`;

    const start = 0.6;
    const travel = 1.8;
    animate(dot, { x: [0, items[items.length - 1].offsetLeft - items[0].offsetLeft], opacity: [0, 1, 1, 0] }, { duration: travel, delay: start, ease: "easeInOut" });
    animate(
      tiles,
      { backgroundColor: [INK, SIGNAL, INK], color: ["#ffffff", INK, "#ffffff"] },
      { duration: 0.5, delay: stagger(travel / (tiles.length - 1), { startDelay: start }) },
    );
  }, { amount: 0.25 });
}

/** the two campuses appear, then traffic crosses the backbone and returns */
function traceTopology(topo: HTMLElement) {
  inView(topo, () => {
    animate($$(".topo-site", topo), { opacity: [0, 1], scale: [0.96, 1] }, { duration: 0.45, ease: OUT, delay: stagger(0.12) });
    const link = $(".topo-link", topo);
    if (!link || !isWide()) return;
    const dot = makeDot(link);
    dot.style.left = "-6px";
    dot.style.top = "calc(50% - 6px)";
    animate(dot, { x: [0, link.offsetWidth, 0], opacity: [0, 1, 1, 1, 0] }, { duration: 2.6, delay: 0.5, ease: "easeInOut" });
  }, { amount: 0.4 });
}

/** every role starts at full width and settles at its own, narrower, level of access */
function narrowLadder(ladder: HTMLElement) {
  inView(ladder, () => {
    $$(":scope > li", ladder).forEach((li, i) => {
      const inset = parseFloat(getComputedStyle(li).marginLeft);
      animate(
        li,
        { opacity: [0, 1], marginLeft: ["0px", `${inset}px`], marginRight: ["0px", `${inset}px`] },
        { duration: 0.8, ease: OUT, delay: 0.1 + i * 0.1 },
      ).finished.then(() => {
        // hand the width back to the stylesheet so it keeps responding to resizes
        li.style.marginLeft = "";
        li.style.marginRight = "";
      });
    });
  }, { amount: 0.25 });
}

function revealTiles(list: HTMLElement) {
  inView(list, () => {
    animate($$(":scope > li", list), { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, ease: OUT, delay: stagger(0.05) });
  }, { amount: 0.3 });
}

/** a result counts up to its final value; the markup always holds the real number */
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  const text = el.textContent ?? "";
  inView(el, () => {
    animate(0, to, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => (el.textContent = text.replace(/\d+/, String(Math.round(v)))),
    });
  }, { amount: 0.8 });
}

/** the certificate lands on the panel when scrolled to, and straightens up when hovered */
function placeCertificate(thumb: HTMLElement) {
  const settle = { type: "spring", visualDuration: 0.5, bounce: 0.25 } as const;
  inView(thumb, () => {
    animate(thumb, { opacity: [0, 1], rotate: [-9, -2], y: [28, 0] }, settle);
  }, { amount: 0.3 });
  hover(thumb, () => {
    animate(thumb, { rotate: 0, scale: 1.03 }, settle);
    return () => animate(thumb, { rotate: -2, scale: 1 }, settle);
  });
}

export function initProjectMotion() {
  if (reducedMotion()) return;
  document.documentElement.classList.add("motion-on");
  $$(".cert-thumb").forEach(placeCertificate);
  $$(".proj-deep .flow-stack").forEach(traceFlow);
  $$(".proj-deep .topo").forEach(traceTopology);
  $$(".proj-deep .scope-ladder").forEach(narrowLadder);
  $$(".proj-deep .vlans").forEach(revealTiles);
  $$(".proj-deep [data-count]").forEach(countUp);
}
