# WeatherTweaker

A Marinara Engine extension that adds a popup in the chat toolbar to **tweak weather effects** (rain, snow, fog, etc.) in real-time. Adjust opacity, speed, size, particle count, brightness, contrast, and color tint — without polluting the chat screen.

## Features

- **Toolbar popup** — click the cloud icon in the roleplay chat header
- **7 sliders** for opacity, speed, size, count, brightness, contrast, tint
- **16 weather presets** — force any weather type (rain, snow, thunderstorm, aurora, etc.)
- **Real-time** — changes take effect immediately via React fiber particle injection
- **Per-chat persistence** — each RP chat stores its own settings (opacity, speed, presets, tint) in localStorage, restored when you switch back
- **Clean integration** — uses the same popup style as Summary, Author's Notes, Active World Info

## Installation

Open Marinara Engine, go to **Settings → Extensions**, click **Import** and select `weatherTweaker.extension.json`.

## Usage

1. Open a roleplay chat in Marinara Engine
2. Click the cloud icon (**☁️**) in the toolbar at the top of the chat
3. Adjust the sliders:

| Control | Effect | Range |
|---|---|---|
| **Opacity** | Multiplies particle transparency | 0 – 3 |
| **Speed** | Multiplies particle velocity | 0 – 3 |
| **Size** | Multiplies particle scale | 0 – 3 |
| **Count** | Multiplies particle count | 0 – 3 |
| **Brightness** | CSS brightness filter on canvas | 0 – 3 |
| **Contrast** | CSS contrast filter on canvas | 0 – 3 |
| **Tint** | Color overlay (mix-blend-mode) | 0 – 0.5 |
| **Weather** | Force a preset or return to Auto | — |

The button glows when settings deviate from defaults or a preset is active.

### Weather presets

Auto, Clear, Cloudy, Rain, Heavy Rain, Thunderstorm, Snow, Blizzard, Fog, Sandstorm, Hail, Windy, Cherry Blossom, Ember, Ash, Aurora

## How it works

**Particle manipulation** — WeatherTweaker traverses the React fiber tree from the weather `<canvas>` to access `particlesRef` inside the `WeatherEffects` component. On each animation frame (`requestAnimationFrame`), the extension loop can:

- Replace particles with preset-generated ones (forced weather)
- Adjust particle properties (opacity, velocity, scale)
- Override particle count
- Apply CSS filters (brightness, contrast) to the canvas
- Inject a color tint overlay

**Chat detection** — the active chat ID is read from the sidebar's `data-chat-id` attribute on the currently selected conversation entry. Each chat stores its own configuration and original-particle snapshot in `localStorage`, so switching between chats restores their individual settings seamlessly.

The original particles are snapshotted before any forced override, so switching back to "Auto" restores the AI-driven weather for that specific chat.

## Files

| File | Purpose |
|---|---|
| `weatherTweaker.extension.json` | Ready-to-import extension bundle |
| `weatherTweaker.js` | Readable source JS |
| `build.js` | Build script that generates the JSON |

## Requirements

- Marinara Engine ≥ v1.5.0 (with extension CSS/JS support)
- **Dynamic weather effects** enabled: **Settings → Appearance → Dynamic weather effects**
- **World State** agent active in the chat's Roleplay HUD

If either setting is missing, the popup shows a help message with setup instructions.

## Uninstall

**Settings → Extensions → Delete** on WeatherTweaker.

## License

MIT
