# 🏁 DO IT LIKE A DREAMER

> *Follow your heart and do it like a dreamer.*

**A single HTML file. Zero frameworks. Zero build steps. 11,000 RPM.**

**Do It Like A Dreamer** is an informational single-page experience about the bleeding edge of the browser — where every technique described on the page is the one running behind the text as you read it. The world outside your windshield is one WebGL2 fragment shader. Your scrollbar is the throttle. The tachometer goes to eleven.

It exists to prove a point: you don't need a framework, a bundler, or a single dependency to build something cinematic on the web in 2026. `index.html` is the entire product, and **view source is the documentation**.

https://x.com/MushroomFleet/status/2077993611099078815 <- see here for more info ;)

---

## ✨ What's inside

- 🌅 **A procedural world in one fragment shader** — the dusk gradient, noise-carved ridgelines, a perspective-projected highway, and twin rivers of tail-lights, all painted per-pixel from pure math. No textures. No meshes. No three.js. As you scroll, a `uJourney` uniform rolls the world from sunset into starlit night and out the other side into dawn.
- 🎚️ **The scrollbar as throttle** — scroll velocity feeds the engine model. A live HUD tracks RPM, gear, speed, and ten shift-light LEDs. The rev-bar at the top of the page is pure CSS (`animation-timeline: scroll(root)`) — no JavaScript touches it.
- 🎛️ **Scroll-scrubbed choreography** — cards animated on `view()` timelines, driven by the compositor, running forwards *and backwards* with your scroll.
- 🎨 **OKLCH color** — hue-cycling gradient type via `@property`-registered custom properties, `color-mix()`, and Display-P3 output on wide-gamut screens.
- 🔤 **Variable type with a throttle** — one font file, two axes (`wght` 100–900, `wdth` 62–125), both operated live by your scroll position.
- 🔴 **A tachometer that goes to eleven** — a canvas gauge whose needle is a damped spring *simulation*, not a tween. The overshoot and the shiver at redline are physics. The wobble is the point.
- 🔊 **A live-synthesized engine note** — Web Audio API: two sawtooth oscillators a firing-order apart, a sub-octave, band-passed intake noise, and a `tanh` waveshaper so it growls instead of buzzes. Nothing is a video. Nothing is a sample.
- 🔨 **DROP THE HAMMER** — a scripted six-gear pull to the 11,000 rpm limiter, with gear-change RPM drops, flashing shift lights, and the world tearing into hyperspeed streaks.

## 🚀 Quick start

No install. No build.

```bash
git clone https://github.com/MushroomFleet/do-it-like-a-dreamer-html.git
cd do-it-like-a-dreamer-html

# option 1: just open it
start index.html          # windows
open index.html           # macOS

# option 2: serve it
python -m http.server 8347
# → http://localhost:8347
```

The page is fully self-contained except for two Google Fonts (Archivo + IBM Plex Mono), which degrade gracefully offline.

## 🎮 Controls

| Input | Action |
|---|---|
| **Scroll** | Accelerate — drives the engine, the HUD, and the world |
| **H** or the big orange button | Drop the hammer: six-gear pull to 11,000 rpm |
| **M** | Mute / unmute the synthesized engine |
| **Mouse** | Subtle camera parallax |

Deep links: `?jump=<section>` (e.g. `?jump=redline`) scrolls straight to a section. Debug extras: `?peek=<section>` renders a section without scrolling, `?rpm=<n>` pins the tachometer — handy for screenshots and headless testing.

## 🗺️ The route

| | Section | Demonstrates |
|---|---|---|
| 00 | **Like a Dreamer** | The hero — gradient display type over the shader world |
| 01 | **One shader, whole horizon** | WebGL2 / GLSL, with live render telemetry |
| 02 | **The scrollbar is the timeline** | CSS scroll-driven animations (`scroll()` / `view()`) |
| 03 | **Color that keeps its nerve** | OKLCH, `@property`, `color-mix()`, Display-P3 |
| 04 | **Type at speed** | Variable font axes scrubbed by scroll |
| 05 | **11,000 rpm** | Canvas + spring physics + Web Audio synthesis |
| 06 | **Dawn** | The journey ends where the lyric began |

## 🧭 Browser support

Best experienced in a current **Chrome or Edge** (Safari 26+ also supports scroll-driven animations). Everything degrades politely: without scroll-timeline support the cards simply stand still; without WebGL2 you get a CSS-gradient sky; `prefers-reduced-motion` is honored throughout.

## 📁 Project structure

```
do-it-like-a-dreamer-html/
├── index.html    ← the entire experience (~1,300 lines: HTML + CSS + GLSL + JS)
├── prompt.md     ← the original brief
└── README.md
```

That's it. That's the stack.

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{do_it_like_a_dreamer,
  title = {Do It Like A Dreamer: a single-file WebGL2 scroll experience tuned to 11,000 RPM},
  author = {Drift Johnson},
  year = {2026},
  url = {https://github.com/MushroomFleet/do-it-like-a-dreamer-html},
  version = {1.0.0}
}
```

### Donate:

[![Ko-Fi](https://cdn.ko-fi.com/cdn/kofi3.png?v=3)](https://ko-fi.com/driftjohnson)
