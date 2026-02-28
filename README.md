# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

### dev

```sh
npx openapi-typescript http://localhost:8000/openapi.json \
  -o src/lib/api/schema.ts

```

## Releases (Commitizen + changelog)

Tworzenie commita konwencjonalnego (Commitizen):

```sh
npm run commit
```

Pierwszy release beta dla `0.3.4` (ustawia `0.3.4-beta.0`, generuje `CHANGELOG.md`, commit i tag):

```sh
npm run release:beta:first
```

Kolejny release beta (np. `0.3.4-beta.1`, `0.3.4-beta.2`):

```sh
npm run release:beta
```

Normalny release (bez prerelease):

```sh
npm run release
```
