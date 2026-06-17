# postmerkOS web interface

This repository contains the optional browser management interface for postmerkOS. It connects to configd over an authenticated WebSocket and uses the same validation, capability, account, service, updater, and hardware APIs as the serial/SSH console.

## Interface

The main front-panel view is organized around four actions:

- **Legend** — port-state reference
- **Update** — configuration backup/restore and firmware management
- **Configuration** — ports, switching, network, accounts, SSH, time, services, terminal, and system information
- **Logout**

Selecting a front-panel port opens a focused editor. The All Ports overlay provides a scrollable table and port cloning. Controls are filtered by administrator, operator, or viewer capabilities and every request is enforced by configd.

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
