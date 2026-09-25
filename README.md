# Little Bounce

A cozy, touch-first bouncing-block game for iPhone and desktop browsers. Drag to aim, press **Shoot** to launch, collect green `+1` orbs, and keep the blocks above the floor. The **Undo** button restores the board from before the last shot.

## Play on iPhone

Open [Little Bounce](https://egosashimi.github.io/little-bounce/) in Safari. To save it as an app, tap **Share → Add to Home Screen**. The game supports offline play after its files have cached.

## Local development

```sh
npm ci
npm run build:pages
```

The static site is built into `pages-dist/`. Pushing to `main` runs the GitHub Pages workflow.
