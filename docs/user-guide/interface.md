# Current interface behavior

The browser uses configd as the sole configuration, validation, status, and authorization authority. Connection startup performs WebSocket negotiation with subprotocol `configd-ws`, protocol `hello`, account authentication, then role-filtered status/configuration subscriptions.

## Main areas

- **Legend** — port-state and speed reference.
- **Update** — configuration backup/restore and firmware management.
- **Configuration** — port/switching, network, accounts, SSH keys, time, services, telemetry, terminal, and System Information.
- **Logout** — revoke the current browser session.

Selecting a graphical port opens a focused editor. All Ports provides the complete editable table, filters, and cloning. Edits are kept separately from the last confirmed configuration; Apply sends only the delta, and Discard restores the last server-confirmed state.

Controls are filtered by the authenticated capability set, but configd independently enforces every request.

## Authentication and reconnect

The login page distinguishes transport failure, handshake/subprotocol failure, protocol mismatch, authentication failure, and disconnected state. Token authentication may restore an allowed session, while revoked/expired sessions return to login. Pending requests are correlated by ID and rejected on disconnect instead of being silently retained.
