/* Letter-by-letter heading reveals. Screen readers get the plain text via an sr-only copy. */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $$ } from "../core/dom";


export function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? "";
  el.textContent = "";
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = text;
  const vis = document.createElement("span");
  vis.setAttribute("aria-hidden", "true");
  const chars: HTMLElement[] = [];
  // group letters into unbreakable words so lines only wrap at spaces
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      vis.appendChild(document.createTextNode(" "));
      return;
    }
    const word = document.createElement("span");
    word.className = "wd";
    for (const c of part) {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c;
      s.dataset.c = c;
      word.appendChild(s);
      chars.push(s);
    }
    vis.appendChild(word);
  });
  el.append(sr, vis);
  return chars;
}

/** letters rise into place one after another (proportional serif, so no glyph swapping) */
function rise(chars: HTMLElement[]) {
  return gsap.fromTo(
    chars,
    { opacity: 0, yPercent: 60 },
    { opacity: 1, yPercent: 0, duration: 0.7, ease: "power3.out", stagger: 0.025, paused: true },
  );
}
export function initHeadingReveals() {
  $$(".h-text").forEach((el) => {
    const chars = splitChars(el);
    const tween = rise(chars);
    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => tween.play(),
    });
  });
}

/** Hero intro: name letters flip up, then the rest of the hero follows. */
export function heroIntro() {
  const name = document.getElementById("hero-name");
  if (!name) return;
  const chars = splitChars(name);
  const tl = gsap.timeline();
  tl.fromTo(
    chars,
    { opacity: 0, y: "0.35em", rotateX: -70 },
    { opacity: 1, y: 0, rotateX: 0, duration: 0.9, ease: "expo.out", stagger: 0.04 },
  );
  tl.from(".hero .roles, .hero .lead, .hero .tag-row, .hero .cta", { opacity: 0, y: 16, duration: 0.7, ease: "power2.out", stagger: 0.08 }, 0.4);
  tl.from(".hero-stage", { opacity: 0, y: 40, scale: 0.96, duration: 1.1, ease: "power3.out" }, 0.55);
  tl.from(".readout", { opacity: 0, y: 20, duration: 0.6, ease: "power2.out", stagger: 0.07 }, 0.9);
  return tl;
}
