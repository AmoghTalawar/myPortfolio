/* Persistent preferences + a tiny event bus shared by every module. */

const KEYS = { sound: "deck.sound", best: "orbitrun.best" } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be blocked (private mode); preferences then last for the visit only */
  }
}

type Events = {
  sound: boolean;
  best: number;
};

const bus = new EventTarget();

export function on<K extends keyof Events>(name: K, fn: (detail: Events[K]) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<Events[K]>).detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
}

function emit<K extends keyof Events>(name: K, detail: Events[K]) {
  bus.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Whether the boot screen already played in this tab. Storage can be blocked, so it never throws. */
export function hasBooted(): boolean {
  try {
    return sessionStorage.getItem("deck.booted") === "1";
  } catch {
    return false;
  }
}

export function markBooted() {
  try {
    sessionStorage.setItem("deck.booted", "1");
  } catch {
    /* blocked storage only means the boot screen plays again next time */
  }
}

/** Stored sound preference. Sound is off until the visitor opts in. */
export function getSoundPref(): boolean {
  return read(KEYS.sound) === "on";
}

export function setSoundPref(onOff: boolean) {
  write(KEYS.sound, onOff ? "on" : "off");
  emit("sound", onOff);
}

export function getBest(): number {
  const n = Number(read(KEYS.best));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function setBest(n: number) {
  write(KEYS.best, String(Math.floor(n)));
  emit("best", Math.floor(n));
}
