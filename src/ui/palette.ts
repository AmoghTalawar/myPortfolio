/* Ctrl/⌘K command palette: jump to sections, toggle sound, switch theme, launch the game. */
import { $, icon } from "../core/dom";
import { sfx } from "../audio/sound";

export interface Command {
  id: string;
  label: string | (() => string);
  icon: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

export function initPalette(getCommands: () => Command[]) {
  const dialog = $<HTMLDialogElement>("#palette")!;
  const input = $<HTMLInputElement>("#palette-input")!;
  const list = $("#palette-list")!;
  let items: Command[] = [];
  let active = 0;

  const labelOf = (c: Command) => (typeof c.label === "function" ? c.label() : c.label);

  function render() {
    const q = input.value.trim().toLowerCase();
    items = getCommands().filter((c) => !q || (labelOf(c) + " " + (c.keywords ?? "")).toLowerCase().includes(q));
    active = Math.min(active, Math.max(items.length - 1, 0));
    list.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matching commands. Try a section name, theme or sound.";
      list.appendChild(li);
      input.removeAttribute("aria-activedescendant");
      return;
    }
    items.forEach((c, i) => {
      const li = document.createElement("li");
      li.id = "pc-" + c.id;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      li.innerHTML = `${icon(c.icon)}<span></span>${c.hint ? `<small></small>` : ""}`;
      li.querySelector("span")!.textContent = labelOf(c);
      if (c.hint) li.querySelector("small")!.textContent = c.hint;
      li.addEventListener("click", () => exec(i));
      li.addEventListener("pointermove", () => {
        if (active !== i) {
          active = i;
          mark();
        }
      });
      list.appendChild(li);
    });
    mark();
  }

  function mark() {
    [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
    const cur = list.children[active] as HTMLElement | undefined;
    if (cur?.id) {
      input.setAttribute("aria-activedescendant", cur.id);
      cur.scrollIntoView({ block: "nearest" });
    }
  }

  function exec(i: number) {
    const c = items[i];
    if (!c) return;
    close();
    // let the dialog close (and focus return) before running, so scroll/focus targets work
    requestAnimationFrame(() => c.run());
  }

  function open() {
    if (dialog.open) return;
    input.value = "";
    active = 0;
    render();
    dialog.showModal();
    input.focus();
    sfx.open();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  input.addEventListener("input", () => {
    active = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % Math.max(items.length, 1);
      mark();
      sfx.tick();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + items.length) % Math.max(items.length, 1);
      mark();
      sfx.tick();
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(active);
    }
  });
  // click on the backdrop closes
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  return { open, close, toggle: () => (dialog.open ? close() : open()), isOpen: () => dialog.open };
}
