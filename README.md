# postmerkos-ui

A Preact management interface for the postmerkOS `configd` protocol.

## Features

- local Linux account authentication before status or configuration is disclosed;
- password updates for authorized accounts;
- firmware image upload and updater status;
- authenticated bounded root command window;
- plain JSON configuration backup and restore;
- desired-state port controls remain editable when link is down, including pre-link PoE enablement;
- click a port graphic to scroll to and highlight its configuration row;
- hover a port for a read-only plain-text status summary;
- persistent unapplied-change notification with Apply and Discard actions.

The production build connects to `ws://<current-host>:4001`. Authentication does not encrypt HTTP/WebSocket traffic; use a trusted management network.

## Development

```sh
npm ci
npm run lint
npm run build
npm run dev
```

The local Vite mock accepts any non-empty username and password. Set `SWITCH_HOST` to proxy a real switch.
