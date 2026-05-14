# WeatherTweaker

A Marinara Engine extension that adds a popup in the chat toolbar to **tweak weather effects** (rain, snow, fog, etc.) in real-time. Adjust opacity, speed, size, particle count, brightness, contrast, and color tint — without polluting the chat screen.

## Features

- **Toolbar popup** — click the cloud icon in the roleplay chat header
- **7 sliders** for opacity, speed, size, count, brightness, contrast, tint
- **16 weather presets** — force any weather type (rain, snow, thunderstorm, aurora, etc.)
- **Real-time** — changes take effect immediately via React fiber particle injection
- **Persistence** — settings saved to localStorage across sessions
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

WeatherTweaker uses a **React fiber traversal** to access `particlesRef` inside the `WeatherEffects` component. On each animation frame, the extension loop (`requestAnimationFrame`) can:

- Replace particles with preset-generated ones (forced weather)
- Adjust particle properties (opacity, velocity, size)
- Override particle count
- Update the canvas CSS filter (brightness/contrast)
- Inject a tint overlay div

The original particles are snapshotted before any forced override, so switching back to "Auto" restores the AI-driven weather seamlessly.

## Files

| File | Purpose |
|---|---|
| `weatherTweaker.extension.json` | Ready-to-import extension bundle |
| `weatherTweaker.js` | Readable source JS |
| `build.js` | Build script that generates the JSON |

## Requirements

- Marinara Engine ≥ v1.5.0 (with extension CSS/JS support)

## Uninstall

**Settings → Extensions → Delete** on WeatherTweaker.

## License

MIT
