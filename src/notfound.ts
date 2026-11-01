/* Custom 404: Orbit Run doubles as the error page. */
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/martian-mono/standard.css";
import "@fontsource-variable/instrument-sans/wdth.css";
import "./styles/main.css";

import { $, $$, hasWebGL } from "./core/dom";
import { getBest, getSoundPref, on } from "./core/settings";
import { setEnabled } from "./audio/sound";
import { launchGame } from "./game/launcher";

const showBest = (n: number) => $$("[data-best]").forEach((el) => (el.textContent = String(n)));
showBest(getBest());
on("best", showBest);

const play = $<HTMLButtonElement>("#play")!;
if (!hasWebGL()) play.hidden = true;

play.addEventListener("click", () => {
  // this click is the user gesture that lets audio start, if the visitor opted in before
  if (getSoundPref()) setEnabled(true);
  launchGame({ exitLabel: "Back to the 404 page" });
});
