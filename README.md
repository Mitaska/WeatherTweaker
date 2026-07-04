# WeatherTweaker

A Marinara Engine extension that adds a popup in the chat toolbar to **tweak weather effects** (rain, snow, fog, etc.) in real-time. Adjust opacity, speed, size, particle count, brightness, contrast, and color tint — without polluting the chat screen.

## Demo
![GIF](assets/demo.gif)

## Features

- **Toolbar popup** — click the cloud icon in the roleplay chat header
- **7 sliders** for opacity, speed, size, count, brightness, contrast, tint
- **17 weather presets** — force any weather type (rain, snow, thunderstorm, aurora, etc.)
- **Standalone mode** — render weather on the extension's own canvas, with **no World State agent and no "Dynamic weather effects" setting required** (see below)
- **Real-time** — changes take effect immediately (via React fiber particle injection in greffé mode, or a self-owned render loop in standalone)
- **Per-chat persistence** — each RP chat stores its own settings (opacity, speed, presets, tint) in localStorage, restored when you switch back
- **Native look** — reuses the engine's chrome tokens (borders, blur, focus ring) so the button and panel match the surrounding toolbar
- **Revamped Aurora** — toggleable custom band-based aurora rendering with `screen` blend mode, diagonal gradients, and 3 style modes
- **Custom starfield & meteors** — twinkling, resize-aware stars (Starry Night) plus falling meteors with glowing trails (Starry Showers)

## Installation

Open Marinara Engine, go to **Settings → Extensions**, click **Import** and select `weatherTweaker.extension.json`.

## Usage

1. Open a roleplay chat in Marinara Engine
2. Click the cloud icon (**☁️**) in the toolbar at the top of the chat
3. The popup is organized in three tabs, with **Standalone** and **Reset** in the footer and the detected refresh rate (e.g. `144Hz ×2.4`) as a badge in the header:

| Tab | Control | Effect | Range / Values |
|---|---|---|---|
| **Weather** | Preset grid | Force a preset (emoji tiles, one click) or return to Auto/Off | — |
| **Weather** | Preset options | Contextual card, only for presets that have options (Aurora: Revamped, Style, Quality, custom colors) | — |
| **Particles** | Opacity | Multiplies particle transparency | 0 – 3 |
| **Particles** | Speed | Multiplies particle velocity (auto-scaled by your display's refresh rate) | 0 – 3 |
| **Particles** | Size | Multiplies particle scale | 0 – 3 |
| **Particles** | Count | Multiplies particle count | 0 – 3 |
| **Scene** | Brightness | CSS brightness filter on canvas | 0 – 3 |
| **Scene** | Contrast | CSS contrast filter on canvas | 0 – 3 |
| **Scene** | Tint | Color overlay (mix-blend-mode) | 0 – 0.5 |
| **Scene** | Celestial | Segmented control: Auto / Sun / Moon / Off | — |
| **Scene** | Position | Move the sun/moon along its sky arc (rising → peak → setting) | 0 – 1 |
| **Scene** | Sun rays | Toggle animated sun rays | On / Off |

The button glows when settings deviate from defaults, a preset is active, or standalone mode is on.

### Standalone mode

By default WeatherTweaker *piggybacks* on the engine's weather canvas, which only exists when **Dynamic weather effects** is on **and** the **World State** agent has produced weather/time data. Without that data the engine renders no canvas, so there is nothing to tweak.

**Standalone mode** removes that dependency: the extension mounts and animates **its own canvas** in the roleplay surface, so weather works with no agent and no appearance setting. Toggle it from the **Standalone** switch in the popup footer (also available on the "not available" screen).

Notes:
- Standalone is a **global** preference (not per-chat) — it changes the rendering backend, not your per-chat settings.
- While standalone is active, the engine's own weather canvas is hidden **and its particle array is emptied** (snapshotted and restored when you toggle standalone off), so the engine's hidden loop stops doing per-frame simulation/draw work behind the extension's.
- Standalone improves on the engine's particle lifecycle: lifetimes stretch to cover the full surface (the stock constants killed slow fallers like snow/petals a third of the way down on tall windows), death waves are de-synchronized so particles flow continuously instead of arriving in batches, and drifting types (petals, leaves, sand) also enter from their upwind edge so the whole screen fills evenly.
- **Auto** has no AI weather to follow in standalone, so it's shown as **None (off)** — pick an explicit preset to see anything.
- **Celestial** follows your explicit Sun/Moon choice (Auto = off in standalone, since there's no in-story hour to track). Use the **Position** slider to place the sun/moon along its arc.

### Performance notes

- **Standalone runs one *effective* render loop.** It draws everything itself, and it neutralizes the engine's hidden weather loop by emptying its particle array (turning that hidden `requestAnimationFrame` into a near-no-op). Turning **off** Settings → Appearance → *Dynamic weather effects* while using standalone still saves the last slice of overhead, but it is no longer required to avoid double rendering.
- **Gradient particles and stars are sprite-cached.** Snow, fog, ember, hail, firefly, and the starfield used to rebuild canvas gradients per particle per frame; they are now baked once into offscreen sprites and stamped with `drawImage` — visually identical, an order of magnitude cheaper. The revamped aurora renders its bands into a reduced-resolution layer and composites it in one pass; the layer resolution is the **Quality** select in the Aurora section (Low = 1/4, Medium = 1/2 — the default, High = native device resolution).
- **Frame-rate independence is built in** (the old *Stable FPS* toggle is gone). Effect cadence — lightning frequency, aurora drift, star twinkle — is normalized to the 60 fps reference on **any** refresh rate (60 / 144 / 240 / 360 Hz, non-standard, or variable-refresh), measured from real elapsed time with an auto-detected refresh rate. Falling particles and meteors are boosted by `refreshHz / 60` so they still travel at your display's *native* speed. At 60 Hz this is identical to the legacy frame-based loop.
  - Long pauses (backgrounded tab, GC, moving the window to another monitor) are skipped rather than clamped, so motion never drifts into slow-motion under load.
- **Speed** stays a simple **0–3** slider: since the boost is automatic, `1` already means native speed on your display and `3` means 3× native — no need for a giant slider range.
- The extension re-inserts its standalone canvas in the render loop and throttles its DOM observers, so it stays cheap even while messages stream.

### Weather presets

Auto, Clear, Cloudy, Rain, Heavy Rain, Thunderstorm, Snow, Blizzard, Fog, Sandstorm, Hail, Windy, Cherry Blossom, Ember, Ash, Aurora, Starry Night, Starry Showers

## How it works

WeatherTweaker runs in one of two rendering modes:

- **Greffé (default)** — it hooks into the engine's existing weather canvas (below).
- **Standalone** — it renders weather on its own canvas, porting the engine's particle/celestial draw routines so the look matches. No agent required, and the only fiber access is a one-time lookup used to empty (and later restore) the hidden host canvas's particle array. This also sidesteps the greffé-mode fragility (a stale config reference, host-only celestial gating).

**Particle manipulation (greffé)** — WeatherTweaker traverses the React fiber tree from the weather `<canvas>` to access `particlesRef` inside the `WeatherEffects` component. On each animation frame (`requestAnimationFrame`), the extension loop can:

- Replace particles with preset-generated ones (forced weather)
- Adjust particle properties (opacity, velocity, scale)
- Override particle count
- Apply CSS filters (brightness, contrast) to the canvas
- Inject a color tint overlay

**Chat detection** — the active chat ID is read from the sidebar's `data-chat-id` attribute on the currently selected conversation entry. Each chat stores its own configuration and original-particle snapshot in `localStorage`, so switching between chats restores their individual settings seamlessly.

**Custom rendering (aurora, lightning, stars, meteors)** — some presets are painted by the extension directly on the canvas (with `globalCompositeOperation: 'screen'`) after the engine's render loop, because the host renderer doesn't recognize their particle types:

- **Aurora** (when `Revamped` is on) — vertical gradient bands with diagonal motion.
- **Lightning** — white-blue overlays (`rgba(220,230,255)`) with frequency and decay matched to the engine's internal lightning.
- **Stars** (Starry Night, Starry Showers base) — each star has its own twinkle phase, speed, color and base opacity. Positions are stored as ratios (`xRatio`, `yRatio`) and multiplied by current canvas dimensions every frame, so the field reflows on window/canvas resize.
- **Meteors** (Starry Showers) — slow, mostly-vertical particles with a tapered linear-gradient trail and a radial-gradient head glow; spawn rate and concurrency capped, despawn on age or screen exit.

All custom passes run inside the same `requestAnimationFrame` callback (`modLoop`) that handles particle injection.

The original particles are snapshotted before any forced override, so switching back to "Auto" restores the AI-driven weather for that specific chat.

## Files

| File | Purpose |
|---|---|
| `weatherTweaker.extension.json` | Ready-to-import extension bundle |
| `weatherTweaker.js` | Readable source JS |
| `build.js` | Build script that generates the JSON |

## Requirements

- Marinara Engine ≥ v2.0.0 (with extension CSS/JS support)

**Greffé mode (default)** additionally needs:
- **Dynamic weather effects** enabled: **Settings → Appearance → Dynamic weather effects**
- **World State** agent active in the chat's Roleplay HUD

If either is missing, the popup shows a help message with setup instructions — and a one-click **Standalone** toggle.

**Standalone mode** needs neither: it only requires being in a roleplay chat.

## Uninstall

**Settings → Extensions → Delete** on WeatherTweaker.

## License

MIT
