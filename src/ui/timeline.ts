/* Experience log: the spine draws itself as you scroll and each entry lights up as the line reaches it. */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $, $$ } from "../core/dom";

export function initTimeline() {
  const log = $("#timeline");
  if (!log) return;
  gsap.fromTo(
    log,
    { "--tl": 0 },
    {
      "--tl": 1,
      ease: "none",
      scrollTrigger: { trigger: log, start: "top 70%", end: "bottom 60%", scrub: 0.6 },
    },
  );
  $$(".log-item", log).forEach((item) => {
    ScrollTrigger.create({
      trigger: item,
      start: "top 66%",
      onEnter: () => item.classList.add("on"),
      onLeaveBack: () => item.classList.remove("on"),
    });
    gsap.from(item.children, {
      opacity: 0,
      x: -14,
      duration: 0.6,
      ease: "power2.out",
      stagger: 0.06,
      scrollTrigger: { trigger: item, start: "top 80%", once: true },
    });
  });
}

/** Count-up for the hero readouts (same behaviour as the original site). */
export function countUp() {
  $$("[data-to]").forEach((el) => {
    const to = +el.dataset.to!, dec = +(el.dataset.dec || 0);
    const pre = el.dataset.pre || "", suf = el.dataset.suf || "";
    const o = { v: 0 };
    gsap.to(o, {
      v: to,
      duration: 1.4,
      ease: "power3.out",
      delay: 0.6,
      onUpdate: () => (el.textContent = pre + o.v.toFixed(dec) + suf),
    });
  });
}
