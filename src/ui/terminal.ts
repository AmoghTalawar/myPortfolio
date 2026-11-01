/* A small terminal for exploring the portfolio. Its files are read from the page itself, so what
   it prints always matches what the site shows. All output is plain text nodes, never parsed as HTML. */
import { animate } from "motion";
import { $, $$, reducedMotion } from "../core/dom";
import { sfx } from "../audio/sound";

type Line = string | { t: string; href?: string; cls?: string };
type Entry = { kind: "file"; lines: Line[]; note: string; open?: () => void };
type Dir = { kind: "dir"; note: string; children: Record<string, Entry | Dir>; open?: () => void };
type FsNode = Entry | Dir;

export interface TerminalOptions {
  goTo: (id: string) => void;
  jumpTo: (el: HTMLElement) => void;
  playGame: () => void;
  toggleSound: () => void;
  soundOn: () => boolean;
  setTheme: (dark: boolean) => void;
  isDark: () => boolean;
  lockScroll: (on: boolean) => void;
}

const USER = "amogh@deck";
const RESUME = "/Amogh-Talawar-Resume.pdf";
const SECTIONS = ["top", "about", "projects", "publications", "experience", "skills", "certificates", "arcade", "contact"];

const COMMANDS: { name: string; usage: string; about: string }[] = [
  { name: "help", usage: "help [command]", about: "Show commands, or how one works" },
  { name: "ls", usage: "ls [-l] [folder]", about: "List files. -l adds a description" },
  { name: "cd", usage: "cd <folder>", about: "Change folder. cd .. goes back" },
  { name: "pwd", usage: "pwd", about: "Show the current folder" },
  { name: "tree", usage: "tree", about: "Show everything at once" },
  { name: "cat", usage: "cat <file>", about: "Read a file here in the terminal" },
  { name: "open", usage: "open <file>", about: "Open it on the site" },
  { name: "find", usage: "find <word>", about: "Search everything, for example find kubernetes" },
  { name: "whoami", usage: "whoami", about: "Who built this" },
  { name: "contact", usage: "contact", about: "Email, GitHub and LinkedIn" },
  { name: "resume", usage: "resume", about: "Download the resume" },
  { name: "github", usage: "github", about: "Open GitHub" },
  { name: "linkedin", usage: "linkedin", about: "Open LinkedIn" },
  { name: "goto", usage: "goto <section>", about: "Scroll to a section of the site" },
  { name: "play", usage: "play", about: "Play Orbit Run" },
  { name: "sound", usage: "sound [on|off]", about: "Turn site sound on or off" },
  { name: "theme", usage: "theme [dark|light]", about: "Switch the site between black and light" },
  { name: "history", usage: "history", about: "Show commands you have run" },
  { name: "clear", usage: "clear", about: "Clear the screen. Ctrl+L also works" },
  { name: "exit", usage: "exit", about: "Close the terminal. Esc also works" },
];
const ALIASES: Record<string, string> = { dir: "ls", ll: "ls -l", less: "cat", more: "cat", type: "cat", man: "help", grep: "find", search: "find", cls: "clear", quit: "exit", start: "open" };

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const textOf = (sel: string, root: ParentNode = document) => clean($(sel, root)?.textContent);
const allText = (sel: string, root: ParentNode = document) => $$(sel, root).map((e) => clean(e.textContent)).filter(Boolean);

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** the likeliest intended command: swapped letters count as one typo, and longer words allow two */
function closest(typed: string) {
  const sorted = (s: string) => [...s].sort().join("");
  const score = (k: string) => (sorted(k) === sorted(typed) ? 1 : editDistance(typed, k));
  const limit = typed.length <= 4 ? 1 : 2;
  const best = (names: string[]) => names.map((k) => [k, score(k)] as const).sort((a, b) => a[1] - b[1])[0];
  const main = best(COMMANDS.map((c) => c.name));
  if (main[1] <= limit) return main[0];
  const alias = best(Object.keys(ALIASES));
  return alias[1] <= limit ? alias[0] : null;
}

export function initTerminal(opts: TerminalOptions) {
  const dialog = $<HTMLDialogElement>("#terminal");
  if (!dialog) return { open() {} };
  const win = $(".term-window", dialog)!;
  const log = $(".term-log", dialog)!;
  const form = $<HTMLFormElement>(".term-form", dialog)!;
  const input = $<HTMLInputElement>(".term-input", dialog)!;
  const path = $(".term-path", dialog)!;

  let root: Dir | null = null;
  let cwd: string[] = [];
  const past: string[] = [];
  let pastAt = 0;
  let greeted = false;

  /* ---------- the files, built from the page the first time they're needed ---------- */
  const closeThen = (fn: () => void) => () => {
    dialog.close();
    requestAnimationFrame(fn);
  };

  const showCard = (card: HTMLElement) => {
    if (card.classList.contains("hide")) $<HTMLButtonElement>('.filter[data-f="all"]')?.click();
    opts.jumpTo(card);
    requestAnimationFrame(() => $<HTMLButtonElement>(".mod-open", card)?.click());
  };

  function projectFile(card: HTMLElement): Entry {
    const lines: Line[] = [];
    const heading = (t: string) => lines.push({ t, cls: "is-head" });
    if (card.classList.contains("proj-pub")) {
      heading(textOf("h3", card));
      lines.push(textOf(".pub-authors", card), textOf(".pub-venue", card), "");
      $$("dl.pub-scores > div", card).forEach((d) => lines.push(`${textOf("dd", d)}  ${textOf("dt", d)}`));
      lines.push("");
      allText(".pub-findings li", card).forEach((t) => lines.push(`- ${t}`));
      lines.push("", `Tools: ${allText(".chip", card).join(", ")}`);
      const paper = $<HTMLAnchorElement>(".pub-actions a", card);
      if (paper) lines.push({ t: "Read the paper", href: paper.href });
      return { kind: "file", lines, note: textOf(".tag", card), open: closeThen(() => opts.jumpTo(card)) };
    }
    heading(textOf(".mod-name", card));
    lines.push({ t: textOf(".mod-tag", card), cls: "is-dim" }, "");
    const panel = $(".row-panel-inner", card);
    if (panel) {
      allText(".proj-paper", panel).forEach((t) => lines.push(t));
      allText(".deep-intro > p:not(.proj-paper), .row-body > p", panel).forEach((t) => lines.push(t));
      const points = allText(".deep-list li, .row-body li", panel);
      if (points.length) lines.push("");
      points.forEach((t) => lines.push(`- ${t}`));
      const fig = clean([...($(".mod-fig", card)?.childNodes ?? [])].map((n) => n.textContent).join(" "));
      if (fig) lines.push("", `Result: ${fig}`);
      lines.push("", `Tools: ${allText(".chip", panel).join(", ")}`);
      const code = $<HTMLAnchorElement>('a[href*="github.com"]', panel);
      if (code) lines.push({ t: "View code", href: code.href });
    }
    return { kind: "file", lines, note: textOf(".mod-tag", card), open: closeThen(() => showCard(card)) };
  }

  function build(): Dir {
    const projects: Record<string, Entry> = {};
    $$("#arc-stage .proj").forEach((card) => {
      if (card.dataset.slug) projects[card.dataset.slug] = projectFile(card);
    });

    const papers: Record<string, Entry> = {};
    $$(".paper").forEach((p, i) => {
      const a = $<HTMLAnchorElement>("h3 a", p);
      const lines: Line[] = [{ t: textOf("h3", p), cls: "is-head" }, { t: textOf(".tag", p), cls: "is-dim" }, "", clean($("p:last-child", p)?.textContent)];
      if (a) lines.push({ t: "Read the paper", href: a.href });
      papers[i === 0 ? "kannada-paper" : "offloading-paper"] = { kind: "file", lines, note: textOf(".tag", p), open: a ? () => window.open(a.href, "_blank", "noopener") : closeThen(() => opts.goTo("publications")) };
    });

    const certs: Record<string, Entry> = {};
    const certNames = ["jncia-junos", "aws-cloud-101", "verizon-cloud", "accenture-data"];
    $$(".cert-main, .cert").forEach((c, i) => {
      const lines: Line[] = [{ t: textOf("h3", c), cls: "is-head" }, { t: textOf(".cert-issuer", c), cls: "is-dim" }];
      allText(".cert-note, .cert-date, .cert-code", c).forEach((t) => lines.push(t));
      const links = $$<HTMLAnchorElement>(".cert-actions a", c);
      links.forEach((a) => lines.push({ t: clean(a.textContent), href: a.href }));
      certs[certNames[i] ?? `certificate-${i}`] = { kind: "file", lines, note: textOf(".cert-issuer", c), open: links[0] ? () => window.open(links[0].href, "_blank", "noopener") : undefined };
    });

    const skills: Line[] = [];
    $$(".skill-group").forEach((g) => skills.push({ t: textOf("h3", g), cls: "is-head" }, allText(".chip", g).join(", "), ""));
    const experience: Line[] = [];
    $$(".log-item").forEach((l) => experience.push({ t: textOf("h3", l), cls: "is-head" }, { t: textOf(".meta", l), cls: "is-dim" }, allText("p:not(.meta)", l).join(" "), ""));
    const email = $<HTMLAnchorElement>('.contact-intro a[href^="mailto:"]')?.href ?? "";

    const section = (id: string) => closeThen(() => opts.goTo(id));
    return {
      kind: "dir",
      note: "",
      children: {
        projects: { kind: "dir", note: "Everything I've built", children: projects, open: section("projects") },
        papers: { kind: "dir", note: "Published and presented research", children: papers, open: section("publications") },
        certificates: { kind: "dir", note: "Credentials you can verify", children: certs, open: section("certificates") },
        "about.txt": { kind: "file", note: "Who I am", lines: allText(".about p"), open: section("about") },
        "experience.txt": { kind: "file", note: "Internship and competitions", lines: experience, open: section("experience") },
        "skills.txt": { kind: "file", note: "Tools I work with", lines: skills, open: section("skills") },
        "hobbies.txt": { kind: "file", note: "Away from the keyboard", lines: allText(".hobby"), open: section("about") },
        "contact.txt": { kind: "file", note: "How to reach me", lines: contactLines(email), open: section("contact") },
        "resume.pdf": { kind: "file", note: "Download with: resume", lines: [{ t: "This is a PDF. Run resume to download it, or:", cls: "is-dim" }, { t: "Open the resume", href: RESUME }], open: () => window.open(RESUME, "_blank", "noopener") },
      },
    };
  }

  function contactLines(email: string): Line[] {
    const links = $$<HTMLAnchorElement>('.contact-intro a[href^="https://"]');
    return [
      { t: email.replace("mailto:", ""), href: email },
      ...links.map((a) => ({ t: clean(a.textContent) || a.href, href: a.href })),
    ];
  }

  const fs = () => (root ??= build());

  /* ---------- paths ---------- */
  const here = () => "~" + cwd.map((p) => "/" + p).join("");
  const lookup = (parts: string[]): FsNode | null => {
    let node: FsNode = fs();
    for (const p of parts) {
      if (node.kind !== "dir" || !(p in node.children)) return null;
      node = node.children[p];
    }
    return node;
  };
  const normalize = (raw: string) => {
    const start = raw.startsWith("/") || raw.startsWith("~") ? [] : [...cwd];
    raw.replace(/^~/, "").split("/").forEach((p) => {
      if (!p || p === ".") return;
      if (p === "..") start.pop();
      else start.push(p);
    });
    return start;
  };

  function eachFile(fn: (parts: string[], file: Entry) => void, node: Dir = fs(), base: string[] = []) {
    Object.entries(node.children).forEach(([name, child]) => {
      if (child.kind === "dir") eachFile(fn, child, [...base, name]);
      else fn([...base, name], child);
    });
  }

  /** the exact path, or a unique partial match so "cat ria" and "cat 5g-test" just work */
  function resolve(raw: string): { parts: string[]; node: FsNode } | { many: string[] } | null {
    const parts = normalize(raw);
    const node = lookup(parts);
    if (node) return { parts, node };
    const word = raw.toLowerCase().replace(/\/$/, "");
    // an exact file name wins over partial matches elsewhere
    const exact: string[][] = [];
    eachFile((p) => {
      if (p[p.length - 1].toLowerCase() === word) exact.push(p);
    });
    if (exact.length === 1) return { parts: exact[0], node: lookup(exact[0])! };
    const hits: string[][] = [];
    eachFile((p) => {
      if (p[p.length - 1].toLowerCase().includes(word)) hits.push(p);
    });
    Object.keys(fs().children).forEach((n) => {
      if (lookup([n])?.kind === "dir" && n.includes(word)) hits.push([n]);
    });
    if (hits.length === 1) return { parts: hits[0], node: lookup(hits[0])! };
    if (hits.length > 1) return { many: hits.map((h) => h.join("/")) };
    return null;
  }

  /* ---------- output ---------- */
  const toBottom = () => {
    log.scrollTop = log.scrollHeight;
  };
  function print(line: Line = "", base = "") {
    const row = document.createElement("div");
    const l = typeof line === "string" ? { t: line } : line;
    row.className = `term-line ${base} ${l.cls ?? ""}`.trim();
    if (l.href) {
      const a = document.createElement("a");
      a.href = l.href;
      a.textContent = l.t;
      a.target = "_blank";
      a.rel = "noopener";
      row.appendChild(a);
    } else {
      row.textContent = l.t;
    }
    log.appendChild(row);
    toBottom();
  }
  const fail = (msg: string) => print(msg, "is-err");

  /** a name that runs a command when clicked, so phones can browse without typing */
  function runButton(label: string, cmd: string, cls = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `term-run ${cls}`.trim();
    b.textContent = label;
    b.addEventListener("click", () => run(cmd));
    return b;
  }

  function listDir(dir: Dir, prefix: string, long: boolean) {
    const row = document.createElement("div");
    row.className = long ? "term-table" : "term-grid";
    Object.entries(dir.children).forEach(([name, child]) => {
      const isDir = child.kind === "dir";
      const cell = runButton(isDir ? name + "/" : name, `${isDir ? "ls" : "cat"} ${prefix}${name}`, isDir ? "is-dir" : "");
      row.appendChild(cell);
      if (long) {
        const note = document.createElement("span");
        note.className = "term-note";
        note.textContent = child.note;
        row.appendChild(note);
      }
    });
    log.appendChild(row);
    toBottom();
  }

  function printTree(dir: Dir, indent: string) {
    const names = Object.keys(dir.children);
    names.forEach((name, i) => {
      const child = dir.children[name];
      const last = i === names.length - 1;
      print({ t: `${indent}${last ? "└── " : "├── "}${name}${child.kind === "dir" ? "/" : ""}`, cls: child.kind === "dir" ? "is-dirline" : "" });
      if (child.kind === "dir") printTree(child, indent + (last ? "    " : "│   "));
    });
  }

  const greet = () => {
    print({ t: "Welcome to Amogh Talawar's portfolio.", cls: "is-head" });
    print("Type help to see what you can do, or start with one of these:");
    const row = document.createElement("div");
    row.className = "term-grid";
    [["ls", "ls"], ["ls projects", "ls projects"], ["open 5g-testbed", "open 5g-testbed"], ["cat about.txt", "cat about.txt"], ["resume", "resume"], ["help", "help"]].forEach(([label, cmd]) => row.appendChild(runButton(label, cmd, "is-chip")));
    log.appendChild(row);
    print();
  };

  /* ---------- commands ---------- */
  const close = () => dialog.close();

  function downloadResume() {
    const a = document.createElement("a");
    a.href = RESUME;
    a.download = "Amogh-Talawar-Resume.pdf";
    a.click();
    print("Downloading the resume.");
  }

  function needsTarget(raw: string | undefined, usage: string) {
    if (raw) return true;
    fail(`Tell me which one. Usage: ${usage}`);
    return false;
  }

  function target(raw: string, cmd: string) {
    const found = resolve(raw);
    if (found && "many" in found) {
      fail(`${cmd}: "${raw}" matches several files. Pick one:`);
      found.many.forEach((m) => print(`  ${m}`, "is-dim"));
      return null;
    }
    if (!found) {
      fail(`${cmd}: ${raw}: no such file or folder. Run ls to see what's here.`);
      return null;
    }
    return found;
  }

  function execute(line: string) {
    const [first, ...args] = line.split(/\s+/);
    let name = first.toLowerCase();
    let rest = args;
    if (ALIASES[name]) {
      const [c, ...extra] = ALIASES[name].split(" ");
      name = c;
      rest = [...extra, ...args];
    }

    switch (name) {
      case "help": {
        if (rest[0]) {
          const c = COMMANDS.find((x) => x.name === (ALIASES[rest[0]] ?? rest[0]).split(" ")[0]);
          if (!c) return fail(`help: no command called ${rest[0]}.`);
          print({ t: c.usage, cls: "is-head" });
          return print(c.about);
        }
        const t = document.createElement("div");
        t.className = "term-table";
        COMMANDS.forEach((c) => {
          t.appendChild(runButton(c.usage, c.usage.includes("<") ? `help ${c.name}` : c.name));
          const note = document.createElement("span");
          note.className = "term-note";
          note.textContent = c.about;
          t.appendChild(note);
        });
        log.appendChild(t);
        print();
        return print({ t: "Tab completes names. Up and Down bring back earlier commands.", cls: "is-dim" });
      }
      case "ls": {
        const long = rest.includes("-l") || rest.includes("-la") || rest.includes("-al");
        const raw = rest.find((a) => !a.startsWith("-"));
        if (!raw) return listDir(lookup(cwd) as Dir, normalizePrefix(cwd), long);
        const found = target(raw, "ls");
        if (!found) return;
        if (found.node.kind === "file") return print(found.parts.join("/"));
        return listDir(found.node, normalizePrefix(found.parts), long);
      }
      case "cd": {
        if (!rest[0] || rest[0] === "~") {
          cwd = [];
          return;
        }
        const found = target(rest[0], "cd");
        if (!found) return;
        if (found.node.kind !== "dir") return fail(`cd: ${rest[0]}: that's a file. Try cat ${rest[0]}.`);
        cwd = found.parts;
        return;
      }
      case "pwd":
        return print(here());
      case "tree":
        print("~");
        return printTree(fs(), "");
      case "cat": {
        if (!needsTarget(rest[0], "cat <file>")) return;
        const found = target(rest[0], "cat");
        if (!found) return;
        if (found.node.kind === "dir") return fail(`cat: ${rest[0]}: that's a folder. Try ls ${rest[0]}.`);
        found.node.lines.forEach((l) => print(l));
        if (found.node.open) print({ t: `See it on the site: open ${found.parts[found.parts.length - 1]}`, cls: "is-dim" });
        return;
      }
      case "open": {
        if (!needsTarget(rest[0], "open <file>")) return;
        const found = target(rest[0], "open");
        if (!found) return;
        if (!found.node.open) return fail(`open: ${rest[0]}: nothing to open. Try cat ${rest[0]}.`);
        print(`Opening ${found.parts[found.parts.length - 1]}.`);
        return found.node.open();
      }
      case "find": {
        const word = rest.join(" ").toLowerCase();
        if (!needsTarget(word, "find <word>")) return;
        let count = 0;
        eachFile((parts, file) => {
          const hit = file.lines.map((l) => (typeof l === "string" ? l : l.t)).find((t) => t.toLowerCase().includes(word));
          const inName = parts.join("/").toLowerCase().includes(word);
          if (!hit && !inName) return;
          count++;
          const row = document.createElement("div");
          row.className = "term-found";
          row.appendChild(runButton(parts.join("/"), `cat ${parts.join("/")}`));
          if (hit) {
            const span = document.createElement("span");
            span.className = "term-note";
            span.textContent = hit.length > 110 ? hit.slice(0, 107) + "..." : hit;
            row.appendChild(span);
          }
          log.appendChild(row);
        });
        toBottom();
        return count ? print({ t: `${count} ${count === 1 ? "file" : "files"} found.`, cls: "is-dim" }) : fail(`find: nothing matches "${word}".`);
      }
      case "whoami":
        print({ t: $<HTMLMetaElement>('meta[name="author"]')?.content ?? "", cls: "is-head" });
        return print(textOf(".hero .lead"));
      case "contact":
        return (lookup(["contact.txt"]) as Entry).lines.forEach((l) => print(l));
      case "resume":
        return downloadResume();
      case "github":
      case "linkedin": {
        const href = $<HTMLAnchorElement>(`.hero a[aria-label="${name === "github" ? "GitHub" : "LinkedIn"}"]`)?.href;
        if (!href) return fail(`${name}: link not found.`);
        print({ t: href, href });
        window.open(href, "_blank", "noopener");
        return;
      }
      case "goto": {
        const id = (rest[0] ?? "").toLowerCase();
        const match = SECTIONS.find((s) => s === id) ?? SECTIONS.find((s) => id && s.startsWith(id));
        if (!match) return fail(`goto: pick one of: ${SECTIONS.join(", ")}`);
        print(`Going to ${match}.`);
        close();
        requestAnimationFrame(() => opts.goTo(match));
        return;
      }
      case "play":
        close();
        requestAnimationFrame(opts.playGame);
        return;
      case "sound": {
        const want = rest[0]?.toLowerCase();
        if (want && want !== "on" && want !== "off") return fail("Usage: sound [on|off]");
        if (want ? (want === "on") !== opts.soundOn() : true) opts.toggleSound();
        return print(`Sound is ${opts.soundOn() ? "on" : "off"}.`);
      }
      case "theme": {
        const want = rest[0]?.toLowerCase();
        if (want && !["dark", "black", "light", "white"].includes(want)) return fail("Usage: theme [dark|light]");
        opts.setTheme(want ? want === "dark" || want === "black" : !opts.isDark());
        return print(`Theme is ${want ? (want === "dark" || want === "black" ? "black" : "light") : opts.isDark() ? "light" : "black"}.`);
      }
      case "history":
        return past.forEach((c, i) => print(`${String(i + 1).padStart(3)}  ${c}`));
      case "clear":
        log.replaceChildren();
        return;
      case "exit":
        return close();
      case "echo":
        return print(rest.join(" "));
      case "sudo":
        return fail("Nice try. You already have every permission this site offers: reading it.");
      case "rm":
      case "mv":
      case "touch":
      case "mkdir":
        return fail(`${name}: this portfolio is read-only.`);
      default: {
        fail(`${first}: command not found.${closest(name) ? ` Did you mean ${closest(name)}?` : " Type help to see what you can do."}`);
      }
    }
  }

  // listed names keep working after a later cd, so they carry the full path
  const normalizePrefix = (parts: string[]) => ["~", ...parts].join("/") + "/";

  function run(raw: string) {
    const line = raw.trim();
    const echo = document.createElement("div");
    echo.className = "term-line is-echo";
    const pr = document.createElement("span");
    pr.className = "term-echo-path";
    pr.textContent = `${USER}:${here()}$ `;
    echo.append(pr, line);
    log.appendChild(echo);
    if (line) {
      past.push(line);
      pastAt = past.length;
      execute(line);
      sfx.tick();
    }
    path.textContent = here();
    toBottom();
    if (dialog!.open) input.focus();
  }

  /* ---------- typing ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    run(v);
  });

  function complete() {
    const v = input.value;
    const start = v.lastIndexOf(" ") + 1;
    const word = v.slice(start);
    const cmd = v.trim().split(/\s+/)[0]?.toLowerCase();
    let options: string[];
    if (start === 0) {
      options = COMMANDS.map((c) => c.name).filter((c) => c.startsWith(word.toLowerCase()));
    } else if (cmd === "goto") {
      options = SECTIONS.filter((s) => s.startsWith(word));
    } else if (cmd === "help") {
      options = COMMANDS.map((c) => c.name).filter((c) => c.startsWith(word));
    } else {
      const slash = word.lastIndexOf("/");
      const folder = word.slice(0, slash + 1);
      const stem = word.slice(slash + 1).toLowerCase();
      const dir = lookup(normalize(folder || "."));
      if (dir?.kind !== "dir") return;
      options = Object.entries(dir.children)
        .filter(([n]) => n.toLowerCase().startsWith(stem))
        .map(([n, c]) => folder + n + (c.kind === "dir" ? "/" : ""));
    }
    if (!options.length) return;
    if (options.length === 1) {
      input.value = v.slice(0, start) + options[0] + (options[0].endsWith("/") ? "" : " ");
      return;
    }
    let common = options[0];
    options.forEach((o) => {
      while (!o.startsWith(common)) common = common.slice(0, -1);
    });
    if (common.length > word.length) {
      input.value = v.slice(0, start) + common;
      return;
    }
    print(options.join("   "), "is-dim");
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (pastAt > 0) input.value = past[--pastAt];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      pastAt = Math.min(pastAt + 1, past.length);
      input.value = past[pastAt] ?? "";
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      log.replaceChildren();
    } else if (e.ctrlKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
      e.preventDefault();
      print(`${USER}:${here()}$ ${input.value}^C`, "is-echo");
      input.value = "";
    }
  });

  // clicking the screen returns to typing, unless text is being selected to copy
  log.addEventListener("click", () => {
    if (!window.getSelection()?.toString()) input.focus();
  });
  $(".term-close", dialog)!.addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  dialog.addEventListener("close", () => opts.lockScroll(false));

  /* ---------- open ---------- */
  function open() {
    if (dialog!.open || document.querySelector("dialog[open]")) return;
    // rebuilt each time: filters and the detail view move content around between visits
    root = build();
    opts.lockScroll(true);
    dialog!.showModal();
    sfx.open();
    if (!greeted) {
      greeted = true;
      greet();
    }
    path.textContent = here();
    input.focus();
    toBottom();
    if (!reducedMotion()) animate(win, { opacity: [0, 1], y: [18, 0], scale: [0.98, 1] }, { type: "spring", visualDuration: 0.3, bounce: 0.1 });
  }

  return { open };
}
