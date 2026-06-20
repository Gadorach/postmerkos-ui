# postmerkOS web interface

This repository contains the optional browser management interface for postmerkOS. It connects to configd on port 4001 using the explicit `configd-ws` WebSocket subprotocol and automatically selects `ws://` or `wss://` to match the page and uses the same validation, capability, account, service, updater, and hardware APIs as the serial/SSH console.

Connection startup is layered: transport handshake, unauthenticated `hello` protocol validation, local-account authentication, then role-gated status/configuration subscriptions. The login screen reports unreachable service, handshake failure, protocol mismatch, disconnected state, and authenticated role separately.

## Interface

The main front-panel view is organized around four actions:

- **Legend** — port-state reference
- **Update** — configuration backup/restore and firmware management
- **Configuration** — ports, switching, network, accounts, SSH, time, services, terminal, and system information
- **Logout**

Selecting a front-panel port opens a focused editor. The All Ports overlay provides a scrollable table and port cloning. Controls are filtered by administrator, operator, or viewer capabilities and every request is enforced by configd.

## Firmware upload

The browser preserves the selected firmware filename and can submit the matching JSON release manifest. This supports full-capacity 8 MiB SquashFS images whose metadata is sidecar-only. Known-incompatible candidates are blocked and cannot be dismissed; untested candidates require explicit acknowledgement. UART transfer is provided by the switch console and host flasher rather than by the browser.

## Development

```sh
npm ci
npm run dev
npm run lint
npm run build
```

The development server includes mock responses for interface work. Production assets are generated under `build/` and installed only when the firmware is built with `INCLUDE_UI=1` or `make web`.

## Backend contract

See `docs/modules/` for source-module responsibilities and the builder repository’s configd protocol documentation for request/response details.

## Reproducible dependency installation

`package-lock.json` must contain public `https://registry.npmjs.org/` package URLs.
Do not commit lockfiles generated with a private CI, proxy, or assistant execution
registry. The repository `.npmrc` pins the public registry, disables the animated npm
progress display, and bounds fetch retries so connectivity errors remain visible.

A clean production build is:

```sh
npm ci --no-audit --no-fund
npm run build
```
