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
3. Adjust the sliders:

| Control | Effect | Range / Values |
|---|---|---|
| **Opacity** | Multiplies particle transparency | 0 – 3 |
| **Speed** | Multiplies particle velocity | 0 – 3 |
| **Size** | Multiplies particle scale | 0 – 3 |
| **Count** | Multiplies particle count | 0 – 3 |
| **Brightness** | CSS brightness filter on canvas | 0 – 3 |
| **Contrast** | CSS contrast filter on canvas | 0 – 3 |
| **Tint** | Color overlay (mix-blend-mode) | 0 – 0.5 |
| **Weather** | Force a preset or return to Auto | — |
| **Celestial** | Force Sun / Moon / None (or Auto) | — |
| **Celestial Position** | Move the sun/moon along its sky arc (rising → peak → setting) | 0 – 1 |
| **Sun Rays** | Toggle animated sun rays | On / Off |
| **Aurora Revamped** |	Toggle custom aurora bands | On / Off |
| **Aurora Style** | Color mode for bands |	Green, Realistic, Custom |
| **Aurora Colors** |	Base + accent pickers (Custom mode) |	any hex |

The button glows when settings deviate from defaults, a preset is active, or standalone mode is on.

### Standalone mode

By default WeatherTweaker *piggybacks* on the engine's weather canvas, which only exists when **Dynamic weather effects** is on **and** the **World State** agent has produced weather/time data. Without that data the engine renders no canvas, so there is nothing to tweak.

**Standalone mode** removes that dependency: the extension mounts and animates **its own canvas** in the roleplay surface, so weather works with no agent and no appearance setting. Toggle it from the **Standalone** switch at the top of the popup (it's also offered on the "not available" screen).

Notes:
- Standalone is a **global** preference (not per-chat) — it changes the rendering backend, not your per-chat settings.
- While standalone is active, the engine's own weather canvas is hidden to avoid double rendering.
- **Auto** has no AI weather to follow in standalone, so it's shown as **None (off)** — pick an explicit preset to see anything.
- **Celestial** follows your explicit Sun/Moon choice (Auto = off in standalone, since there's no in-story hour to track). Use the **Position** slider to place the sun/moon along its arc.

### Weather presets

Auto, Clear, Cloudy, Rain, Heavy Rain, Thunderstorm, Snow, Blizzard, Fog, Sandstorm, Hail, Windy, Cherry Blossom, Ember, Ash, Aurora, Starry Night, Starry Showers

## How it works

WeatherTweaker runs in one of two rendering modes:

- **Greffé (default)** — it hooks into the engine's existing weather canvas (below).
- **Standalone** — it renders weather on its own canvas, porting the engine's particle/celestial draw routines so the look matches. No fiber traversal, no agent. This also sidesteps the greffé-mode fragility (a stale config reference, host-only celestial gating).

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
