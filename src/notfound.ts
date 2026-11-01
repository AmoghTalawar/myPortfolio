/* Custom 404: Orbit Run doubles as the error page. */
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/martian-mono/standard.css";
import "@fontsource-variable/instrument-sans/wdth.css";
import "./styles/main.css";

import { $, $$, hasWebGL } from "./core/dom";
import { getBest, on } from "./core/settings";
import { setEnabled } from "./audio/sound";
import { launchGame } from "./game/launcher";

const showBest = (n: number) => $$("[data-best]").forEach((el) => (el.textContent = String(n)));
showBest(getBest());
on("best", showBest);

const play = $<HTMLButtonElement>("#play")!;
if (!hasWebGL()) play.hidden = true;

// sound is on from the start, and begins on the visitor's first click or key press
setEnabled(true);

play.addEventListener("click", () => {
  launchGame({ exitLabel: "Back to the 404 page" });
});
