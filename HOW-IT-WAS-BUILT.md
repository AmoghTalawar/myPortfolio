# How This Portfolio Was Built

Personal notes for answering "how did you build this?". This file is in the project folder only and is not published with the site.

---

## 1. Short answers you can say

### 10 seconds

> "It's a custom site with no framework: TypeScript, Three.js for the 3D desk and game, and GSAP and Motion for animation, built with Vite. I built it with an AI coding assistant, Claude Code, and directed the design and content myself."

### 30 seconds

> "I didn't use a template or React. The page is plain HTML, CSS and TypeScript, built with Vite. The hero is a 3D desk scene made in Three.js from code, with no 3D model files, and the camera dives into the monitor as you scroll. My projects sit on a circuit board where traces connect projects that share technology. The 5G card replays my real system diagram as a live animation. There's also a working terminal where you can type commands like `ls` and `cat`, and a small game. I used Claude Code as a coding assistant, while I chose the direction, reviewed the results and supplied the content."

### 2 minutes

> "I wanted the site to feel like my field, networks and systems, rather than a template. So I kept the stack small: Vite and TypeScript with no UI framework.
>
> The 3D desk and the Orbit Run game use Three.js, and both load only when needed because Three.js is the largest file on the site. Scrolling uses Lenis, GSAP handles the scroll-linked hero and timeline, and Motion handles interactions such as card springs and the filter indicator.
>
> The most interesting part is the project board. Traces between cards are SVG paths calculated from where the cards sit in the layout, and hovering a project draws signals to others using the same technology. Clicking a card makes it grow into its detail view using a FLIP animation. The 5G card rebuilds my architecture diagram and animates a packet through the edge, cloud and local paths.
>
> The terminal has a small virtual file system built from the page itself, so its content always matches the site.
>
> I also respected reduced-motion settings and keyboard use. I built it with Claude Code, an AI coding assistant, so my role was deciding what to build, supplying the content, reviewing and asking for changes until it was right."

---

## 2. Be honest about AI

**This site was built with Claude Code, an AI coding assistant, working from your direction.** If someone asks, say so. Using AI tools is normal, but claiming you wrote every line yourself could fall apart in an interview.

A good way to say it:

> "I used Claude Code as a pair programmer. I made the product and design decisions, gave it my real project details, and reviewed what it produced. I can walk you through how the main parts work."

**Before an interview, read sections 5 and 6 and open the matching files.** Make sure you can explain anything you plan to mention.

---

## 3. Technology

| Technology | Version | What it does here |
|---|---|---|
| **TypeScript** | 7.0.2 | All site logic, in strict mode |
| **HTML and CSS** | | Page structure and all styling, with no CSS framework |
| **Vite** | 8.3.5 | Dev server and production build |
| **Three.js** | 0.186.1 | 3D desk scene and Orbit Run game |
| **GSAP + ScrollTrigger** | 3.15.0 | Hero scroll animation, heading reveals, experience timeline |
| **Lenis** | 1.3.27 | Smooth scrolling |
| **Motion** | 14.9.0 | Card and filter animations, hover and press responses, scroll-triggered diagrams |
| **Web Audio API** | Browser built-in | All sound effects, generated in code with no audio files |

**No framework:** the site doesn't use React, Next.js, Tailwind or a template.

**About Motion:** this is the non-React version of the library formerly known as Framer Motion. React features like `<motion.div>` and `AnimatePresence` aren't used, because the site has no React. The same effects were built with its plain JavaScript tools. The paid Motion UI components weren't used.

### Fonts (self-hosted)
- **Fraunces:** headings
- **Instrument Sans:** body text
- **Martian Mono:** terminal and small labels
- **Baloo Tamma 2:** the Kannada word on the paper card

### Icons
- **Simple Icons:** technology logos such as PyTorch, Docker and Kubernetes
- **Lucide-style icons:** other interface icons, stored in one SVG sprite in `index.html`

### Colours
| Name | Hex | Used for |
|---|---|---|
| Deep teal | `#0d3b47` | Board, panels, terminal bar |
| Teal accent | `#0f6b6b` | Links, tags, main site accent |
| Amber | `#ffb703` | Signals, cloud path |
| Mint | `#1fb69b` | Edge path |
| Coral | `#ef5b4c` | Local path |
| Ink navy | `#1c2a7a` | Kannada paper card only |

### Hosting and contact form
- **Contact form:** sends messages to an **AWS API Gateway** endpoint in `ap-south-1`.
- **Planned hosting:** Amazon **S3** with **CloudFront**. The steps are in `README.md`.
- **Status when this was written:** the site hadn't been deployed from this project. Update this line once it's live.

---

## 4. Size of the project

| Item | Size |
|---|---|
| TypeScript | About 3,800 lines in 22 files |
| CSS | About 3,900 lines in one file |
| HTML | About 1,100 lines |
| Production build (`dist/`) | 2.9 MB, including resume, certificates and fonts |
| Main JavaScript | About 250 KB |
| Three.js | About 547 KB, loaded separately |

---

## 5. How each feature works

### 3D desk (`src/scene/character.ts`, `src/scene/hero.ts`)
- The desk, character, monitor and shelf objects are built from basic shapes in code, with **no 3D model files**.
- The monitor and laptop screens are drawn on canvases and used as textures. The laptop shows AWS study topics that change every few seconds.
- Desk gadgets include a USRP radio and a Raspberry Pi 5, from real projects, also built from basic shapes.
- GSAP ScrollTrigger pins the scene and links the camera to scrolling, so it dives into the monitor.
- A raycaster detects which shelf object is under the mouse, which shows your hobby labels.
- It pauses when off screen and is skipped if WebGL is missing or reduced motion is on.

### Project circuit board (`src/ui/project-board.ts`)
- Each project is a card in a 12-column CSS grid.
- The ADHD card has an SVG brain (`src/ui/brain-demo.ts`). It is an illustration of the ideas, not model output: be ready to say so if asked.
- **Traces:** SVG paths calculated from each card's position, routed through the gaps. Anything crossing a card passes behind it.
- **Hover:** finds projects sharing a technology logo, then draws yellow traces and sends a signal dot along each one using CSS `offset-path`.
- **Power-on:** when the board first appears, traces draw and cards light up one after another.
- **Detail view:** uses the **FLIP technique**. It measures the card and the final panel, starts the panel looking like the card, then animates it to full size with a spring.
- **Filters:** cards fade out, the rest spring to their new positions, and the traces redraw.

### 5G system diagram (`src/ui/offload-demo.ts`)
- Rebuilds your architecture diagram in HTML: user equipment, RAN, 5G core, scheduler, edge, cloud and internet.
- Connecting lines are SVG paths calculated from where each box actually sits, so they still line up on any screen size.
- A dot follows each line with `offset-path`, leaving a coloured trail and lighting each part it reaches.
- It loops through the three paths (edge, cloud, local), and only runs while on screen.

### Terminal (`src/ui/terminal.ts`)
- A small **virtual file system** in JavaScript, built from the page's content when the terminal opens, so it always matches the site.
- A command parser handles `ls`, `cd`, `cat`, `open`, `find`, `tree` and more.
- Includes Tab completion, command history, partial name matching and typo suggestions based on **edit distance**.
- All output is inserted as plain text, so typed input can't run as code.
- `open` reuses the site's existing card detail view instead of duplicating it.

### Orbit Run game (`src/game/`)
- A 3D game in Three.js with an endless run, 3 lives and combo scoring.
- The level rises every 20 seconds and adds drifting debris, walls and comets. New zones with their own colours and tunnel shape open at 1,000, 3,000, 6,000 and 10,000 points.
- Loaded only when someone starts it, so it doesn't slow the first page load.
- Can also be started with the Konami code.

### Light and black themes (`src/ui/theme.ts`)
- Colours are CSS variables, and `html[data-theme="ink"]` swaps them for the black theme.
- A small script in `<head>` applies the saved choice before the page paints, which prevents a flash of the wrong theme.
- The switch uses the **View Transitions API**: the new theme spreads in a circle from the button, and browsers without it simply switch.
- The floor lamp's pull cord switches the theme. Dragging or tapping it is detected with a raycaster, and the cord moves with a small spring simulation. The sweep starts at the cord's knob, and in the black theme the lamp lights the whole room: a warm point light on the objects, plus a soft glow drawn on an invisible wall and floor.
- The 3D scene relights itself, and the Kannada card keeps its own light colours in both themes.

### Other features
| Feature | File | How it works |
|---|---|---|
| Boot screen | `src/ui/boot.ts` | Each line reports real loading work |
| Command palette (Ctrl+K) | `src/ui/palette.ts` | Searchable list of actions |
| Custom cursor | `src/ui/cursor.ts` | A tilting arrow with a trailing ribbon, a pulse over links and sparks on click |
| Sound effects | `src/audio/sound.ts` | Generated with the Web Audio API |
| Experience timeline | `src/ui/timeline.ts` | The line draws as you scroll |
| Project diagrams | `src/ui/project-motion.ts` | Animated once when scrolled to |
| Contact form | `src/ui/contact.ts` | Sends the form to the API as JSON. A hidden `website` field is included to help spot bots, but filtering on it would have to happen in the backend, which isn't in this project |
| Kannada word reveal | `src/ui/projects.ts` | CSS `clip-path` reveal when scrolled to |

---

## 6. Questions you may be asked

**Why not React?**
> "The site is mostly one page with custom graphics, so a framework wouldn't add much. Vanilla TypeScript kept it simple, and I controlled the DOM directly for the animations."

**Why use both GSAP and Motion?**
> "GSAP was already handling the scroll-linked hero and timeline, where ScrollTrigger is strong. Motion is used for interactions like card springs and filters. Using both adds some size, so one improvement would be to merge them."

**How did you keep it fast with Three.js?**
> "Three.js and the game load separately rather than in the main file. The 3D scene pauses when off screen, and it's skipped for people without WebGL or with reduced motion on."

**How do the traces follow the cards?**
> "They aren't drawn by hand. The code reads each card's position, builds an SVG path through the gaps between cards, and recalculates when the screen size or filter changes."

**What was hard to get right?**
> "Fast filter clicks left some cards invisible. Motion keeps its own record of each element's values, so clearing the styles by hand put the two out of sync. I fixed it by resetting those values through Motion."

**How is it accessible?**
> "Dialogs use the native `<dialog>` element, it works with a keyboard, animations respect the reduced-motion setting, and decorative graphics are hidden from screen readers."

**How was it tested?**
> "With TypeScript strict mode, plus Playwright scripts that ran through the features at desktop, tablet and mobile sizes. Those were one-off scripts, so the repo has no permanent test suite yet. I'd add that next."

**What would you improve?**
- Add a permanent automated test suite.
- Merge GSAP and Motion to reduce JavaScript size.
- Split the 3,900-line CSS file into smaller files.
- Move project content into a data file instead of HTML.

---

## 7. Project structure

```
index.html                 Page content and icon sprite
404.html                   Not-found page
HOW-IT-WAS-BUILT.md        This file
public/
  Amogh-Talawar-Resume.pdf
  certs/                   Certificates and badges
  favicon.svg, og.png, robots.txt
src/
  main.ts                  Starts everything: scrolling, shortcuts, boot
  styles/main.css          All styles
  core/                    Shared helpers and settings
  audio/sound.ts           Generated sound effects
  scene/                   3D desk
  game/                    Orbit Run
  ui/
    project-board.ts       Circuit board, traces, card detail view
    offload-demo.ts        Animated 5G system diagram
    terminal.ts            Command-line terminal
    projects.ts            Filters
    project-motion.ts      Scroll-triggered diagrams
    boot, palette, cursor, reveal, timeline, typewriter, contact, konami
```

---

## 8. Run it yourself

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck and build into dist/
npm run preview    # http://localhost:4173
```

---

## 9. Be careful with these

- **"Hosted on AWS":** the footer says this, so make sure it's true once deployed.
- **The React question:** don't say it uses React or Framer Motion components. It uses Motion's non-React version.
- **"I wrote all the code":** don't say this. Say you built it with Claude Code and directed the work.
- **Backend:** you can only speak to the API Gateway URL from this code. The service behind it isn't in this project, so check it before describing it.
- **Project numbers:** the results shown on the site came from your papers, repos, slides and earlier site text. Be ready to explain any number you mention.
