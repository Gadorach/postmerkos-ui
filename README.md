# postmerkos-ui

A small Preact interface for the postmerkOS `configd` JSON protocol. The UI is a client only: validation, persistence, capability detection, and hardware application remain in `configd`, so the same operations are available to CLI tools and scripts.

## Features

- management IPv4 DHCP/static configuration and live lease status;
- per-port link, PHY, VLAN, STP, storm-control, and PoE desired state;
- PoE controls only on capabilities reported by `configd`;
- strict `af`/`at` mode with a separate enabled flag;
- explicit request IDs, acknowledgements, warning display, and `Bad Request` handling;
- automatic reconnection and status/config broadcasts.

## Development

```sh
npm ci
npm run dev
```

The Vite mock server serves `src/test/24` when `SWITCH_HOST` is unset. To proxy a real switch:

```sh
SWITCH_HOST=192.168.1.20 npm run dev
```

Production checks:

```sh
npm run lint
npm run build
```

The production build connects to `ws://<current-host>:4001`.

## Protocol

```json
{"id":"1","type":"get_config"}
{"id":"2","type":"get_status"}
{"id":"3","type":"config","data":{"ports":{"1":{"poe":{"enabled":true,"mode":"at"}}}}}
```

The browser waits for an explicit `ack` or `error`; it does not treat an unsolicited configuration broadcast as an acknowledgement. A management-address update can close the current socket after acknowledgement, after which the user reconnects at the new address.

## Modules

See [`docs/modules`](docs/modules/README.md).
