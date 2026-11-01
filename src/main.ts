import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/martian-mono/standard.css";
import "@fontsource-variable/instrument-sans/wdth.css";
import "@fontsource-variable/baloo-tamma-2/index.css";
import "./styles/main.css";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import { $, $$, cssColor, hasWebGL, isTyping, reducedMotion, toast } from "./core/dom";
import { getBest, getSoundPref, hasBooted, markBooted, on, setSoundPref } from "./core/settings";
import { isEnabled, setEnabled, sfx } from "./audio/sound";
import { bootStats, dismissBoot, runBoot } from "./ui/boot";
import { initCursor } from "./ui/cursor";
import { heroIntro, initHeadingReveals } from "./ui/reveal";
import { initProjects } from "./ui/projects";
import { initProjectMotion } from "./ui/project-motion";
import { initTerminal } from "./ui/terminal";
import { currentTheme, initTheme } from "./ui/theme";
import { countUp, initTimeline } from "./ui/timeline";
import { copyEmail, initContact } from "./ui/contact";
import { initTypewriter } from "./ui/typewriter";
import { initPalette, type Command } from "./ui/palette";
import { onKonami } from "./ui/konami";
import { isGameOpen, launchGame } from "./game/launcher";
import type { Hero } from "./scene/hero";

gsap.registerPlugin(ScrollTrigger);

const html = document.documentElement;
const reduce = reducedMotion();
const use3D = hasWebGL() && !reduce;
if (use3D) html.classList.add("has-3d");

let lenis: Lenis | null = null;
let hero: Hero | null = null;


/* ---------------- sound toggle ---------------- */
const soundBtn = $<HTMLButtonElement>("#sound-toggle")!;
function syncSoundUI() {
  const onNow = isEnabled();
  soundBtn.setAttribute("aria-pressed", String(onNow));
  soundBtn.setAttribute("aria-label", onNow ? "Sound on. Turn sound off" : "Sound off. Turn sound on");
}
function toggleSound() {
  const next = !isEnabled();
  setEnabled(next);
  setSoundPref(next);
  syncSoundUI();
  if (next) sfx.blip();
  toast(next ? "Sound on" : "Sound off");
}
soundBtn.addEventListener("click", toggleSound);
on("sound", syncSoundUI);

/* ---------------- dialogs ---------------- */
const helpDialog = $<HTMLDialogElement>("#help")!;
function openHelp() {
  if (!helpDialog.open) {
    helpDialog.showModal();
    sfx.open();
  }
}
$$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog")?.close()));
$$<HTMLDialogElement>("dialog.sheet").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  }),
);

/* ---------------- best score ---------------- */
const showBest = (n: number) => $$("[data-best]").forEach((el) => (el.textContent = String(n)));
showBest(getBest());
on("best", showBest);

/* ---------------- game ---------------- */
function openGame() {
  launchGame({
    exitLabel: "Back to the site",
    onOpen() {
      lenis?.stop();
      hero?.setPaused(true);
    },
    onClose() {
      lenis?.start();
      hero?.setPaused(false);
    },
  });
}

/* ---------------- navigation ---------------- */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  sfx.whoosh();
  if (lenis) lenis.scrollTo(el, { offset: id === "top" ? 0 : -72, duration: 1.4 });
  else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  history.replaceState(null, "", "#" + id);
  // move keyboard focus to the section heading without a second scroll
  const h = el.querySelector<HTMLElement>("h1, h2");
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  const id = a.getAttribute("href")!.slice(1);
  if (id && document.getElementById(id)) {
    e.preventDefault();
    goTo(id);
  }
});
$$("[data-action='game']").forEach((b) => b.addEventListener("click", openGame));
$$("[data-action='help']").forEach((b) => b.addEventListener("click", openHelp));

/* pill nav: highlight whichever section is in the middle of the screen */
const sideLinks = $$<HTMLAnchorElement>(".nav-links a");
const spy = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      sideLinks.forEach((a) =>
        a.getAttribute("href") === "#" + en.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"),
      );
    }),
  { rootMargin: "-45% 0px -50% 0px" },
);
$$("main > [id]").forEach((s) => spy.observe(s));

/* ---------------- theme ---------------- */
const theme = initTheme({
  onChange(next) {
    hero?.setColors(cssColor("--b"), "#5b8def", next === "paper");
  },
});

/* ---------------- command palette ---------------- */
const sections: [string, string, string][] = [
  ["top", "Home", "home"],
  ["about", "About", "user"],
  ["projects", "Projects", "folder"],
  ["publications", "Papers", "file"],
  ["experience", "Experience", "briefcase"],
  ["skills", "Skills", "code"],
  ["certificates", "Certificates", "medal"],
  ["sidequests", "Side Quests", "flask"],
  ["contact", "Contact", "mail"],
  ["message", "Send a message", "send"],
];
function lockScroll(on: boolean) {
  html.classList.toggle("view-lock", on);
  if (on) lenis?.stop();
  else lenis?.start();
}
const terminal = initTerminal({
  goTo,
  jumpTo(el) {
    if (lenis) lenis.scrollTo(el, { immediate: true, force: true, offset: -110 });
    else el.scrollIntoView({ block: "start" });
  },
  playGame: openGame,
  toggleSound,
  soundOn: isEnabled,
  setTheme: (dark) => theme.set(dark ? "ink" : "paper"),
  isDark: () => currentTheme() === "ink",
  lockScroll,
});
$("#open-terminal")!.addEventListener("click", terminal.open);

const palette = initPalette((): Command[] => [
  ...sections.map(([id, label, ic]) => ({ id: "go-" + id, label: `Go to ${label}`, icon: ic, keywords: "section jump", run: () => goTo(id) })),
  { id: "terminal", label: "Open the terminal", icon: "terminal", hint: "T", keywords: "cli shell command line console", run: terminal.open },
  { id: "game", label: "Play Orbit Run", icon: "play", hint: "G", keywords: "game arcade", run: openGame },
  { id: "theme", label: () => (currentTheme() === "ink" ? "Switch to light theme" : "Switch to black theme"), icon: "moon", hint: "D", keywords: "dark mode night appearance colour color", run: () => theme.toggle() },
  { id: "sound", label: () => (isEnabled() ? "Turn sound off" : "Turn sound on"), icon: "vol", hint: "M", keywords: "audio mute", run: toggleSound },
  { id: "copy", label: "Copy email address", icon: "copy", keywords: "contact", run: copyEmail },
  { id: "help", label: "Keyboard shortcuts", icon: "help", hint: "?", run: openHelp },
]);
$("#open-palette")!.addEventListener("click", palette.open);

/* ---------------- keyboard shortcuts ---------------- */
addEventListener("keydown", (e) => {
  if (isGameOpen() || $("#boot")) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "k") {
    e.preventDefault();
    palette.toggle();
    return;
  }
  if (document.querySelector("dialog[open]") || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "?") {
    e.preventDefault();
    openHelp();
  } else if (k === "m") toggleSound();
  else if (k === "g") openGame();
  else if (k === "d") theme.toggle();
  else if (k === "t" || e.key === "`") {
    e.preventDefault();
    terminal.open();
  }
});
onKonami(() => {
  if (!isGameOpen()) openGame();
});

/* ---------------- static content behaviour ---------------- */
initContact();
initTypewriter(reduce);
initCursor();
initProjects({ lockScroll });
initProjectMotion();
syncSoundUI();

/* top bar gets a frosted background once the page scrolls */
const barEl = $(".bar")!;
const onScrollBar = () => barEl.classList.toggle("scrolled", scrollY > 20);
addEventListener("scroll", onScrollBar, { passive: true });
onScrollBar();

/* ---------------- hero 3D ---------------- */
function wireHero(mod: typeof import("./scene/hero")) {
  const canvas = $<HTMLCanvasElement>("#hero-3d")!;
  const tip = $("#shelf-tip")!;
  const cursorEl = $(".cursor");
  hero = mod.createHero(canvas, {
    // teal accent on the monitor and laptop
    colors: { a: cssColor("--b"), b: "#5b8def" },
    light: currentTheme() === "paper",
    onLampPull(x, y) {
      theme.toggle({ x, y });
    },
    onShelfHover(label, x, y) {
      cursorEl?.classList.toggle("is-hover", !!label);
      tip.classList.toggle("show", !!label);
      if (label) {
        tip.textContent = label;
        tip.style.left = x + "px";
        tip.style.top = y + "px";
        if (tip.dataset.last !== label) sfx.tick();
      }
      tip.dataset.last = label ?? "";
    },
  });
  // pin the full-screen stage and dive into the monitor; its "About" title card then
  // hands off to the real About section, covered by a page-coloured fade at the very end
  const stage = $(".hero-stage")!;
  const hint = $(".stage-hint");
  ScrollTrigger.create({
    trigger: stage,
    start: "top 100px", // just below the floating nav
    end: "+=130%",
    pin: true,
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      hero?.setScroll(Math.min(1, p / 0.78));
      // fade the whole board away so the About section takes over
      stage.style.opacity = String(Math.min(1, Math.max(0, 1 - (p - 0.79) / 0.1)));
      stage.style.pointerEvents = p > 0.88 ? "none" : "";
      if (hint) hint.style.opacity = String(Math.max(0, 1 - p * 5));
    },
  });
}

/* ---------------- boot ---------------- */
async function start() {
  const loaded: { hero?: typeof import("./scene/hero") } = {};
  const stats = bootStats();
  const fast = reduce || hasBooted();
  const timeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((r) => setTimeout(r, ms))]);

  const withSound = await runBoot(
    [
      { label: "loading typefaces", run: async () => void (await timeout(document.fonts.ready, 2500)) },
      {
        label: "building the 3D desk",
        run: async () => {
          if (!use3D) return reduce ? "skipped (reduced motion)" : "skipped (no WebGL)";
          try {
            loaded.hero = await timeout(import("./scene/hero"), 8000);
            return loaded.hero ? "ok" : "skipped (slow connection)";
          } catch {
            return "skipped";
          }
        },
      },
      { label: "drawing topography", run: async () => "ok" },
      { label: "indexing projects", run: async () => String(stats.projects) },
      { label: "indexing papers", run: async () => String(stats.papers) },
      { label: "reading experience log", run: async () => `${stats.log} entries` },
      { label: "arcade", run: async () => `best score ${getBest()}` },
    ],
    { fast, preferSound: getSoundPref() },
  );

  setEnabled(withSound);
  setSoundPref(withSound);
  syncSoundUI();
  if (withSound) sfx.open();
  markBooted();

  // smooth scroll
  if (!reduce) {
    lenis = new Lenis({ lerp: 0.12 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis!.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  if (loaded.hero) wireHero(loaded.hero);
  else html.classList.remove("has-3d");

  await dismissBoot(reduce);
  // honour a deep link like /#projects after the boot screen
  const deep = location.hash.slice(1);
  if (deep && document.getElementById(deep)) {
    lenis ? lenis.scrollTo("#" + deep, { immediate: true, offset: -72 }) : document.getElementById(deep)!.scrollIntoView();
  }
  if (location.hash === "#play") openGame();

  const bar = $("#progress")!;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => (bar.style.transform = `scaleX(${self.progress})`),
  });

  if (!reduce) {
    heroIntro();
    countUp();
    initHeadingReveals();
    initTimeline();
  }
  ScrollTrigger.refresh();
}

start();
