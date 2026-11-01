/* Opens Orbit Run in a full-screen overlay. The game module (and three.js) load on demand. */
import { sfx, isEnabled, setEnabled } from "../audio/sound";
import { getBest, setBest, setSoundPref } from "../core/settings";
import { hasWebGL, reducedMotion, toast } from "../core/dom";
import type { GameHandle } from "./orbit-run";

let handle: GameHandle | null = null;
let opening = false;

export function isGameOpen() {
  return !!handle || opening;
}

export interface LaunchHooks {
  onOpen?(): void;
  onClose?(): void;
  exitLabel?: string;
}

export async function launchGame(hooks: LaunchHooks = {}) {
  if (handle || opening) return;
  if (!hasWebGL()) {
    toast("Orbit Run needs WebGL, which this browser has turned off.");
    return;
  }
  const root = document.getElementById("game-root");
  if (!root) return;
  opening = true;
  const returnFocus = document.activeElement as HTMLElement | null;
  try {
    const { startOrbitRun } = await import("./orbit-run");
    root.hidden = false;
    // everything else is inert while the game has the screen
    const others = [...document.body.children].filter((el) => el !== root) as HTMLElement[];
    others.forEach((el) => (el.inert = true));
    hooks.onOpen?.();
    handle = startOrbitRun(root, {
      sfx,
      // read from the overlay: it keeps the dark palette even when the page is white
      colors: { a: getComputedStyle(root).getPropertyValue("--a").trim() || "#5eead4", b: getComputedStyle(root).getPropertyValue("--b").trim() || "#818cf8" },
      getBest,
      setBest,
      reducedMotion: reducedMotion(),
      exitLabel: hooks.exitLabel ?? "Back to the deck",
      soundButton: {
        isOn: isEnabled,
        toggle() {
          const next = !isEnabled();
          setEnabled(next);
          setSoundPref(next);
        },
      },
      onExit() {
        handle?.dispose();
        handle = null;
        root.hidden = true;
        others.forEach((el) => (el.inert = false));
        hooks.onClose?.();
        returnFocus?.focus?.();
      },
    });
  } catch (err) {
    console.error(err);
    toast("Orbit Run failed to load. Check your connection and try again.");
  } finally {
    opening = false;
  }
}
