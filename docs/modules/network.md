# Network panel module

`src/network.jsx` edits `network.ipv4` and displays observed `status.network.ipv4`.

## DHCP input

```json
{"mode":"dhcp","fallback_address":"169.254.0.10/16","mtu":1500}
```

## Static input

```json
{"mode":"static","address":"192.168.1.20/24","gateway":"192.168.1.1","mtu":1500}
```

All validation is performed by configd. The panel warns that changing the management address can disconnect the current browser session.
