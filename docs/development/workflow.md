# Development and release workflow

## Requirements

- Node.js 20 or newer
- npm using the public registry pinned by `.npmrc`

## Commands

```sh
npm ci --no-audit --no-fund
npm run dev
npm run docs:check
npm run lint
npm test
npm run build
```

The development server uses mock configd responses. Set `SWITCH_HOST` only for deliberate live-device testing. Production output is under `build/`.

`package-lock.json` must keep public `https://registry.npmjs.org/` URLs and must not capture a private CI or proxy registry.

## Release integration

meraki-builder fetches the selected authoritative UI revision, runs the production build for `make web`, and installs the static assets into the firmware. Backend request changes require synchronized configd protocol/contract updates before release.
