# postmerkOS web interface

This repository contains the optional browser management interface for postmerkOS. It requires Node.js 20 or newer for development and connects to the firmware’s configd WebSocket API in production.

## Development quick start

```sh
npm ci --no-audit --no-fund
npm run dev
```

The Vite development server supplies mock configd data unless `SWITCH_HOST` is intentionally set to a live switch.

Before submitting changes:

```sh
npm run docs:check
npm run lint
npm test
npm run build
```

Production assets are generated under `build/` and are installed by meraki-builder only for a web-enabled firmware build.

## Documentation

The [UI documentation database](docs/README.md) contains current interface behavior, responsive/mobile layout rules, backend contracts, module responsibilities, development workflow, and project history. All documentation changes must follow [DOCUMENTATION-RULES.md](DOCUMENTATION-RULES.md).
