<div align="center">

# LAST FRONTIER

### One zone. One survivor.

An original, single-player 3D battle royale. Drop into the Badlands, gear up,
take on 15 AI operatives, and outlast the storm.

[**▶ PLAY LIVE**](https://xyz-game-eight.vercel.app/) ·
[View source](https://github.com/koundalvivek073-dotcom/xyz-game)

**Three.js** · **Vite** · **WebGL** · **Godot 4**

</div>

---

## The mission

Explore a 360 × 360 m frontier, search supply cases for ammo and medkits, and
adapt as the safe zone closes in. Blue cases keep you in the fight; rare gold
cases upgrade your rifle. Defeat all 15 operatives to claim the win.

| 🌩️ Survive | 🎒 Gear up | 🎯 Fight |
| --- | --- | --- |
| Stay inside the shrinking storm. | Find supplies and improve your loadout. | Take on 15 AI operatives. |

## Play

**[Launch Last Frontier →](https://xyz-game-eight.vercel.app/)**

Works in a modern browser with WebGL support. Touch devices have an on-screen
movement stick and action buttons.

| Action | Controls |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Sprint | `Shift` |
| Jump / cut parachute | `Space` |
| Look | Mouse |
| Fire / aim | Left / right mouse button |
| Reload | `R` |
| Use medkit | `H` |
| Cycle scope | `V` |
| Pause / close panels | `Esc` |
| Toggle sound | `M` |
| Swap weapons | `1` / `2` / `3` |

## Run locally

### Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm
- A modern browser with WebGL support

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build:

```sh
npm run build
npm run preview
```

The production site is written to `dist/`. This generated output is not checked
into Git.

## Deploy

The project is configured for [Vercel](https://vercel.com/). Import the
[GitHub repository](https://github.com/koundalvivek073-dotcom/xyz-game) and
deploy with the default settings. [`vercel.json`](./vercel.json) configures
Vite's production build and the `dist/` output directory. Vercel can then build
and deploy each push to the connected branch.

## Tests

Run the browser-game core tests with:

```sh
npm test
```

The tests cover terrain dimensions and boundaries, storm progression, weapon
configuration, bot names, and world-collider raycasts.

## Godot project

The repository also includes a separate Godot 4.3+ implementation. Open
[`project.godot`](./project.godot) in Godot and run the project; the main scene
is configured in the project settings.

## Project layout

| Path | Contents |
| --- | --- |
| `index.html` | Browser-game shell, lobby, settings, and HUD |
| `src/` | Three.js gameplay, rendering, input, UI, audio, and effects |
| `tests/` | Node.js tests for core game systems |
| `project.godot`, `scenes/`, `scripts/`, `shaders/` | Godot project |
| `public/` | Static assets |

## License

[CC0 1.0 Universal](./LICENSE)
