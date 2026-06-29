# Contributing

Open an issue before large architectural changes so hardware assumptions, image-size effects, and backend compatibility can be reviewed first. Focused fixes and documentation improvements are welcome as pull requests.

## Development

```sh
npm ci
npm run dev
```

Open the development URL printed by Vite. The default development server provides mock configd responses. Set `SWITCH_HOST` only when intentionally connecting to a live switch.

Before submitting:

```sh
npm run docs:check
npm run lint
npm test
npm run build
```

Backend protocol changes must remain compatible with the optional-web configd build and must update the relevant user, backend-contract, and module documentation. Follow [`DOCUMENTATION-RULES.md`](DOCUMENTATION-RULES.md).

## Releases

Release notes are maintained in [`docs/history/changelog.md`](docs/history/changelog.md). The release workflow builds with Node/npm and publishes the production assets as a ZIP archive.
