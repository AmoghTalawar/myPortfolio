const SEQ = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

export function onKonami(fn: () => void) {
  let i = 0;
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    i = k === SEQ[i] ? i + 1 : k === SEQ[0] ? 1 : 0;
    if (i === SEQ.length) {
      i = 0;
      fn();
    }
  });
}
