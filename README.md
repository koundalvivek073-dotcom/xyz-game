# Last Frontier

Last Frontier is a single-player, 3D battle royale game. The browser version is
built with Three.js and Vite; a Godot 4 project is also included.

## Browser game

### Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm
- A modern browser with WebGL support

### Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build:

```sh
npm run build
npm run preview
```

The production site is written to `dist/`. It is generated output and is not
checked into Git.

### Deploy to Vercel

Import this repository in Vercel and deploy with the default project settings.
The checked-in `vercel.json` configures Vite's production build and `dist/`
output directory. Vercel will build and deploy the site on each push to the
connected branch.

### Play

Defeat 15 AI operatives and survive the shrinking storm. Find supply cases for
ammo and medkits; gold cases upgrade your rifle. The lobby includes settings
for bot difficulty, render quality, look sensitivity, audio, and touch input.

| Action | Controls |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Sprint | `Shift` |
| Jump / cut parachute | `Space` |
| Look | Mouse |
| Fire | Left mouse button |
| Aim | Right mouse button |
| Reload | `R` |
| Use medkit | `H` |
| Cycle scope | `V` |
| Pause / close panels | `Esc` |
| Toggle sound | `M` |
| Swap weapons | `1` / `2` / `3` |

Touch devices have an on-screen movement stick and action buttons.

## Godot project

The `project.godot` file opens a separate Godot 4.3+ implementation. Open that
file in Godot and run the project (the main scene is configured in the project
settings).

## Tests

Run the browser-game core tests with:

```sh
npm test
```

They cover terrain dimensions and boundaries, storm progression, weapon
configuration, bot names, and world-collider raycasts.

## Project layout

- `index.html` — browser-game shell, lobby, settings, and HUD
- `src/` — Three.js gameplay, rendering, input, UI, audio, and effects
- `tests/` — Node.js tests for core game systems
- `project.godot`, `scenes/`, `scripts/`, `shaders/` — Godot project
- `public/` — static assets

## License

See [LICENSE](LICENSE) (CC0 1.0 Universal).
