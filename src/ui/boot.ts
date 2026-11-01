/* Terminal-style boot sequence. Each line reports real work (fonts, renderer, content index);
   it resolves with the visitor's sound choice once they press Enter. */
import { $, $$ } from "../core/dom";

export interface BootTask {
  label: string;
  run: () => Promise<string | void>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runBoot(tasks: BootTask[], opts: { fast: boolean; preferSound: boolean }): Promise<boolean> {
  const boot = $("#boot")!;
  const log = $("#boot-log")!;
  const bar = $("#boot-bar")!;
  const meter = $(".boot-meter", boot)!;
  const actions = $("#boot-actions")!;

  document.body.classList.add("is-booting");
  const others = [...document.body.children].filter((el) => el !== boot && el.tagName !== "SCRIPT") as HTMLElement[];
  others.forEach((el) => (el.inert = true));

  const lineDelay = opts.fast ? 0 : 110;
  const setProgress = (k: number) => {
    bar.style.transform = `scaleX(${k})`;
    meter.setAttribute("aria-valuenow", String(Math.round(k * 100)));
  };

  for (let i = 0; i < tasks.length; i++) {
    const li = document.createElement("li");
    li.textContent = tasks[i].label + " ";
    log.appendChild(li);
    let result: string | void = undefined;
    try {
      result = await tasks[i].run();
    } catch {
      result = "skipped";
    }
    const s = document.createElement("span");
    s.textContent = result || "ok";
    li.appendChild(s);
    setProgress((i + 1) / tasks.length);
    if (lineDelay) await wait(lineDelay);
  }

  actions.hidden = false;
  const soundBtn = $<HTMLButtonElement>("#enter-sound")!;
  const quietBtn = $<HTMLButtonElement>("#enter-quiet")!;
  // the visitor's last choice becomes the highlighted default
  if (!opts.preferSound) {
    soundBtn.classList.remove("primary");
    quietBtn.classList.add("primary");
    quietBtn.after(soundBtn);
    quietBtn.focus();
  } else soundBtn.focus();

  const withSound = await new Promise<boolean>((resolve) => {
    soundBtn.addEventListener("click", () => resolve(true), { once: true });
    quietBtn.addEventListener("click", () => resolve(false), { once: true });
  });

  others.forEach((el) => (el.inert = false));
  return withSound;
}

/** Fade the boot overlay away, then remove it. */
export function dismissBoot(reduce: boolean): Promise<void> {
  const boot = $("#boot")!;
  boot.classList.add("done");
  document.body.classList.remove("is-booting");
  return new Promise((resolve) => {
    if (reduce) {
      boot.remove();
      return resolve();
    }
    const anim = boot.animate(
      [
        { opacity: 1, clipPath: "inset(0 0 0 0)" },
        { opacity: 1, clipPath: "inset(49.6% 0 49.6% 0)", offset: 0.55 },
        { opacity: 0, clipPath: "inset(50% 50% 50% 50%)" },
      ],
      { duration: 700, easing: "cubic-bezier(.7,0,.3,1)" },
    );
    anim.onfinish = () => {
      boot.remove();
      resolve();
    };
  });
}

export function bootStats() {
  return {
    projects: $$("#arc-stage .proj").length,
    papers: $$(".paper").length,
    log: $$(".log-item").length,
    stations: $$("[data-station]").length,
  };
}
