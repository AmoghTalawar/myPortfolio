/* Projects as modules on a circuit board.
   The board powers on once when scrolled to, hovering traces the tools a project shares with
   others, and selecting a module grows that card into its full detail view. */
import { animate, hover, inView, press, stagger } from "motion";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $, $$, reducedMotion } from "../core/dom";
import { sfx } from "../audio/sound";

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const NS = "http://www.w3.org/2000/svg";
const OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const GROW = { type: "spring", visualDuration: 0.5, bounce: 0.1 } as const;
const MOVE = { type: "spring", visualDuration: 0.5, bounce: 0.14 } as const;

/** position inside the board; unaffected by the transforms used while animating */
function rectOf(card: HTMLElement): Rect {
  const left = card.offsetLeft;
  const top = card.offsetTop;
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

/** a polyline with chamfered corners, the way circuit traces are routed */
function chamfer(points: [number, number][], cut = 9) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const c = Math.min(cut, inLen / 2, outLen / 2);
    if (c < 1) {
      d += ` L${x} ${y}`;
      continue;
    }
    d += ` L${x - ((x - px) / inLen) * c} ${y - ((y - py) / inLen) * c}`;
    d += ` L${x + ((nx - x) / outLen) * c} ${y + ((ny - y) / outLen) * c}`;
  }
  const end = points[points.length - 1];
  return `${d} L${end[0]} ${end[1]}`;
}

/** routes through the gaps between modules; anything crossing a module passes behind it */
function route(a: Rect, b: Rect, gap: number): string {
  const sameRow = Math.abs(a.top - b.top) < 2;
  if (sameRow) {
    const [l, r] = a.left < b.left ? [a, b] : [b, a];
    if (r.left - l.right < gap + 2) {
      const y = l.top + Math.min(l.height, r.height) / 2;
      return chamfer([[l.right, y], [r.left, y]]);
    }
    const y = Math.max(l.bottom, r.bottom) + gap / 2;
    const lx = l.left + l.width / 2;
    const rx = r.left + r.width / 2;
    return chamfer([[lx, l.bottom], [lx, y], [rx, y], [rx, r.bottom]]);
  }
  const [up, down] = a.top < b.top ? [a, b] : [b, a];
  const ux = up.left + up.width / 2;
  const dx = down.left + down.width / 2;
  const y1 = up.bottom + gap / 2;
  const y2 = down.top - gap / 2;
  // rows next to each other share one gap, so no detour is needed
  if (y2 - y1 < 2) return chamfer([[ux, up.bottom], [ux, y1], [dx, y1], [dx, down.top]]);
  const vx = down.left - gap / 2;
  return chamfer([[ux, up.bottom], [ux, y1], [vx, y1], [vx, y2], [dx, y2], [dx, down.top]]);
}

const techOf = (card: HTMLElement) => (card.dataset.tech ?? "").split(" ").filter(Boolean);

export function initProjectBoard(opts: { lockScroll: (on: boolean) => void }) {
  const board = $(".proj-board");
  const grid = $(".board-grid");
  const note = $(".board-note");
  if (!board || !grid) return null;

  const cards = $$<HTMLElement>(".proj", grid);
  const reduce = reducedMotion();
  // the line above the board only speaks while a project is being traced
  const defaultNote = "";

  // details stay in the page without scripts; with them, they open in the detail view
  cards.forEach((c) => ($(".row-panel", c)!.hidden = true));

  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("board-traces");
  svg.setAttribute("aria-hidden", "true");
  const baseLayer = document.createElementNS(NS, "g");
  const hotLayer = document.createElementNS(NS, "g");
  svg.append(baseLayer, hotLayer);
  const pulses = document.createElement("div");
  pulses.className = "board-pulses";
  pulses.setAttribute("aria-hidden", "true");
  board.prepend(svg);
  board.append(pulses);

  const gap = () => parseFloat(getComputedStyle(grid).columnGap) || 24;
  const visible = () => cards.filter((c) => !c.classList.contains("hide"));

  const makePath = (d: string, cls: string, parent: SVGGElement) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("pathLength", "1");
    p.setAttribute("class", cls);
    parent.appendChild(p);
    return p;
  };

  /** the idle wiring: each module linked to the next one on the board */
  function drawBase(animated: boolean) {
    svg.setAttribute("width", String(board!.offsetWidth));
    svg.setAttribute("height", String(board!.offsetHeight));
    baseLayer.replaceChildren();
    const list = visible();
    list.slice(1).forEach((card, i) => {
      const p = makePath(route(rectOf(list[i]), rectOf(card), gap()), "trace", baseLayer);
      if (animated) {
        animate(p, { strokeDashoffset: [1, 0] }, { duration: 0.5, ease: "easeInOut", delay: 0.1 + i * 0.13 });
      } else p.style.strokeDashoffset = "0";
    });
  }

  function sendPulse(d: string, reversed: boolean, duration = 0.7) {
    const dot = document.createElement("span");
    dot.className = "board-pulse";
    dot.style.offsetPath = `path("${d}")`;
    pulses.appendChild(dot);
    const anim = animate(
      dot,
      { offsetDistance: reversed ? ["100%", "0%"] : ["0%", "100%"], opacity: [0, 1, 1, 0] },
      { duration, ease: "easeInOut" },
    );
    anim.finished.then(() => dot.remove());
    return anim;
  }

  /* ---------- power on: traces draw, then each module lights up in turn ---------- */
  let powered = false;
  function powerOn() {
    if (powered) return;
    powered = true;
    board!.classList.add("is-powered");
    if (reduce) return drawBase(false);
    drawBase(true);
    const list = visible();
    animate(list, { opacity: [0, 1], scale: [0.95, 1] }, { duration: 0.45, ease: OUT, delay: stagger(0.13) })
      .finished.then(() => list.forEach((c) => (c.style.opacity = "")));
  }

  /* ---------- hover: light the projects that share a technology ---------- */
  function clearFocus() {
    hotLayer.replaceChildren();
    board!.classList.remove("has-focus");
    cards.forEach((c) => c.classList.remove("is-dim", "is-lit", "is-source"));
    if (note) note.textContent = defaultNote;
  }

  function focusCard(card: HTMLElement) {
    clearFocus();
    if (!powered) return;
    const tech = techOf(card);
    const related = visible().filter((c) => c !== card && techOf(c).some((t) => tech.includes(t)));
    board!.classList.add("has-focus");
    card.classList.add("is-source");
    visible().forEach((c) => {
      if (c !== card && !related.includes(c)) c.classList.add("is-dim");
    });
    const here = rectOf(card);
    related.forEach((other, i) => {
      const there = rectOf(other);
      const d = route(here, there, gap());
      // routes always run left to right or top to bottom; run the signal away from this card
      const startsHere = Math.abs(here.top - there.top) < 2 ? here.left < there.left : here.top < there.top;
      const path = makePath(d, "trace trace-hot", hotLayer);
      if (reduce) {
        path.style.strokeDashoffset = "0";
        other.classList.add("is-lit");
        return;
      }
      animate(path, { strokeDashoffset: [startsHere ? 1 : -1, 0] }, { duration: 0.45, ease: "easeOut", delay: i * 0.03 });
      sendPulse(d, !startsHere, 0.6).finished.then(() => {
        if (board!.classList.contains("has-focus")) other.classList.add("is-lit");
      });
    });
    if (note) {
      const name = $(".mod-name", card)?.textContent ?? "This project";
      const n = related.length;
      note.textContent = n ? `${name} shares tools with ${n} other ${n === 1 ? "project" : "projects"}.` : `${name} uses tools no other project here does.`;
    }
  }

  /* If the note grows when its text wraps, the board moves down and the card slides out from
     under the pointer, which ends the hover and snaps it back; a click can then miss the card.
     So the note always keeps room for its longest message. Touch screens never show it. */
  function reserveNoteRoom() {
    if (!note || !matchMedia("(hover: hover)").matches) return;
    const current = note.textContent;
    const longest = cards.map((c) => $(".mod-name", c)?.textContent ?? "").reduce((a, b) => (b.length > a.length ? b : a), "");
    note.style.minHeight = "";
    let tallest = 0;
    for (const text of [`${longest} shares tools with ${cards.length} other projects.`, `${longest} uses tools no other project here does.`]) {
      note.textContent = text;
      tallest = Math.max(tallest, note.offsetHeight);
    }
    note.textContent = current;
    note.style.minHeight = `${tallest}px`;
  }
  reserveNoteRoom();
  document.fonts?.ready.then(reserveNoteRoom);
  addEventListener("resize", reserveNoteRoom, { passive: true });

  /* ---------- selecting a module grows it into the detail view ---------- */
  const view = $<HTMLDialogElement>("#proj-view")!;
  const panel = $(".proj-view-panel", view)!;
  const scrim = $(".proj-view-scrim", view)!;
  const content = $$(".proj-view-head, .proj-view-body", view);
  const body = $(".proj-view-body", view)!;
  let openCard: HTMLElement | null = null;
  let closing = false;

  const flipFrom = (card: HTMLElement) => {
    const from = card.getBoundingClientRect();
    panel.style.transform = "none";
    const to = panel.getBoundingClientRect();
    return { x: from.left - to.left, y: from.top - to.top, sx: from.width / to.width, sy: from.height / to.height };
  };

  function openView(card: HTMLElement) {
    if (openCard) return;
    openCard = card;
    clearFocus();
    opts.lockScroll(true);

    $("#proj-view-title", view)!.textContent = $(".mod-name", card)?.textContent ?? "";
    $(".proj-view-tag", view)!.textContent = $(".mod-tag", card)?.textContent ?? "";
    $(".proj-view-ic use", view)!.setAttribute("href", $(".mod-ic use", card)?.getAttribute("href") ?? "");
    body.classList.toggle("proj-deep", card.classList.contains("proj-deep"));
    body.appendChild($(".row-panel-inner", card)!);
    panel.scrollTop = 0;
    view.showModal();
    sfx.blip();

    if (reduce) {
      card.style.visibility = "hidden";
      return;
    }
    const f = flipFrom(card);
    card.style.visibility = "hidden";
    animate(panel, { x: [f.x, 0], y: [f.y, 0], scaleX: [f.sx, 1], scaleY: [f.sy, 1] }, GROW);
    animate(scrim, { opacity: [0, 1] }, { duration: 0.28 });
    animate(content, { opacity: [0, 1] }, { duration: 0.28, delay: 0.16 });
  }

  function finishClose() {
    const card = openCard;
    if (!card) return;
    $$<HTMLVideoElement>("video", body).forEach((v) => v.pause());
    $(".row-panel", card)!.appendChild($(".row-panel-inner", body)!);
    card.style.visibility = "";
    panel.style.transform = "";
    // close while still marked open: focus returning to the card must not start a trace
    if (view.open) view.close();
    openCard = null;
    closing = false;
    opts.lockScroll(false);
    ScrollTrigger.refresh();
  }

  function closeView() {
    if (!openCard || closing) return;
    closing = true;
    $$<HTMLVideoElement>("video", body).forEach((v) => v.pause());
    sfx.blip();
    if (reduce) return finishClose();
    const card = openCard;
    card.style.visibility = "";
    const from = card.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    card.style.visibility = "hidden";
    // the panel's own transform is at rest here, so its rect is the target to shrink away from
    animate(content, { opacity: 0 }, { duration: 0.12 });
    animate(scrim, { opacity: 0 }, { duration: 0.25 });
    animate(
      panel,
      { x: from.left - to.left, y: from.top - to.top, scaleX: from.width / to.width, scaleY: from.height / to.height },
      { type: "spring", visualDuration: 0.34, bounce: 0 },
    ).finished.then(finishClose);
  }

  scrim.addEventListener("click", closeView);
  $(".proj-view-close", view)!.addEventListener("click", closeView);
  view.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeView();
  });
  // anything else that closes the dialog still returns the details to their card
  view.addEventListener("close", () => {
    if (openCard) finishClose();
  });

  cards.forEach((card) => {
    const btn = $<HTMLButtonElement>(".mod-open", card)!;
    const plus = $(".mod-plus", card)!;
    btn.addEventListener("click", () => openView(card));
    hover(btn, () => {
      focusCard(card);
      if (!reduce) animate(plus, { rotate: 90 }, { type: "spring", visualDuration: 0.35, bounce: 0.3 });
      return () => {
        clearFocus();
        if (!reduce) animate(plus, { rotate: 0 }, { type: "spring", visualDuration: 0.35, bounce: 0 });
      };
    });
    btn.addEventListener("focus", () => {
      if (!openCard && btn.matches(":focus-visible")) focusCard(card);
    });
    btn.addEventListener("blur", () => {
      if (!openCard) clearFocus();
    });
    press(btn, () => {
      if (!reduce) animate(btn, { scale: 0.98 }, { type: "spring", visualDuration: 0.2, bounce: 0 });
      return () => {
        if (!reduce) animate(btn, { scale: 1 }, { type: "spring", visualDuration: 0.3, bounce: 0.4 });
      };
    });
  });

  /* ---------- filters: modules leave, then the rest spring to their new places ---------- */
  let filterRun = 0;
  let filterMotions: ReturnType<typeof animate>[] = [];
  function applyFilter(want: (card: HTMLElement) => boolean, all: boolean) {
    const run = ++filterRun;
    powerOn();
    clearFocus();

    // a new choice replaces any transition still playing. Reset through Motion, not the style
    // attribute: it tracks these values itself and would otherwise write the old ones back.
    filterMotions.forEach((m) => m.stop());
    filterMotions = [];
    animate(cards, { x: 0, y: 0, scale: 1, opacity: 1 }, { duration: 0 });

    const layout = () => {
      if (run !== filterRun) return;
      const before = new Map(visible().map((c) => [c, rectOf(c)]));
      cards.forEach((c) => c.classList.toggle("hide", !want(c)));
      grid!.classList.toggle("is-filtered", !all);
      visible().forEach((c, i) => {
        const was = before.get(c);
        if (reduce) return;
        if (was) {
          const now = rectOf(c);
          filterMotions.push(animate(c, { x: [was.left - now.left, 0], y: [was.top - now.top, 0] }, { ...MOVE, delay: i * 0.015 }));
        } else {
          filterMotions.push(animate(c, { opacity: [0, 1], scale: [0.92, 1] }, { ...MOVE, delay: 0.05 + i * 0.015 }));
        }
      });
      drawBase(!reduce);
      setTimeout(() => {
        if (run === filterRun) ScrollTrigger.refresh();
      }, 160);
    };

    const leaving = visible().filter((c) => !want(c));
    if (reduce || !leaving.length) return layout();
    const exit = animate(leaving, { opacity: 0, scale: 0.96 }, { duration: 0.14 });
    filterMotions.push(exit);
    exit.finished.then(layout);
  }

  /* ---------- start, and keep the wiring lined up with the layout ---------- */
  if (reduce) powerOn();
  else {
    let onScreen = false;
    inView(board, () => {
      powerOn();
      onScreen = true;
      return () => {
        onScreen = false;
      };
    }, { amount: 0.08 });
    // now and then a signal crosses one trace, only while the board is on screen and idle
    setInterval(() => {
      if (!onScreen || document.hidden || openCard || board.classList.contains("has-focus")) return;
      const paths = $$<SVGPathElement & HTMLElement>(".trace", baseLayer as unknown as ParentNode);
      const pick = paths[Math.floor(Math.random() * paths.length)];
      if (pick) sendPulse(pick.getAttribute("d")!, false, 1.1);
    }, 3200);
  }

  let resizeTimer = 0;
  const redraw = () => {
    if (powered) drawBase(false);
  };
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(redraw, 120);
  }, { passive: true });
  document.fonts?.ready.then(redraw);

  return { applyFilter };
}
