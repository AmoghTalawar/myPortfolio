/* Light and black themes. The choice is saved, and an inline script in index.html applies it
   before first paint so a returning visitor never sees a flash of the wrong theme. */
import { $, reducedMotion } from "../core/dom";
import { sfx } from "../audio/sound";

export type ThemeName = "paper" | "ink";

const KEY = "deck.mode";
const BAR_COLOR: Record<ThemeName, string> = { paper: "#ffffff", ink: "#000000" };

export const currentTheme = (): ThemeName => (document.documentElement.dataset.theme === "ink" ? "ink" : "paper");

export function initTheme(opts: { onChange: (theme: ThemeName) => void }) {
  const button = $<HTMLButtonElement>("#theme-toggle");
  let active: ViewTransition | null = null;
  // what was last asked for: a switch applies a moment later, so a quick second pull must read this
  let wanted = currentTheme();

  const syncButton = () => {
    const dark = currentTheme() === "ink";
    button?.setAttribute("aria-pressed", String(dark));
    button?.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to black theme");
    if (button) button.title = `${dark ? "Switch to light theme" : "Switch to black theme"} (D)`;
  };

  const apply = (theme: ThemeName) => {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[theme]);
    $('meta[name="color-scheme"]')?.setAttribute("content", theme === "ink" ? "dark" : "light");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage can be blocked; the theme then lasts for this visit only */
    }
    syncButton();
    opts.onChange(theme);
  };

  /** the new theme spreads out in a circle from whatever triggered the change */
  function set(theme: ThemeName, origin?: { x: number; y: number }) {
    if (theme === wanted) return;
    wanted = theme;
    sfx.blip();
    const swap = document.startViewTransition;
    if (!swap || reducedMotion()) return apply(theme);

    const box = button?.getBoundingClientRect();
    const x = origin?.x ?? (box ? box.left + box.width / 2 : innerWidth / 2);
    const y = origin?.y ?? (box ? box.top + box.height / 2 : 0);
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // a new switch replaces a sweep that is still playing
    active?.skipTransition();
    const transition = document.startViewTransition(() => apply(wanted));
    active = transition;
    transition.finished.finally(() => {
      if (active === transition) active = null;
    }).catch(() => {});
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
        { duration: 600, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  }

  const toggle = (origin?: { x: number; y: number }) => set(wanted === "ink" ? "paper" : "ink", origin);
  button?.addEventListener("click", () => toggle());
  syncButton();
  return { set, toggle };
}
