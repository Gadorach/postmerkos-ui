# Backend and session contract

The browser connects to configd on port 4001 with WebSocket subprotocol `configd-ws`. It selects `ws://` or `wss://` to match the page origin.

Connection phases are transport, `hello` protocol validation, authentication/token restoration, and role-gated subscriptions. Requests carry unique string IDs; responses resolve only the matching promise. Pending requests fail on disconnect, malformed JSON is reported without disabling reconnect, and uncorrelated server errors are surfaced globally.

The browser sends configuration deltas and renders server broadcasts as authoritative confirmed state. It never writes target files, applies Click handlers, changes Linux accounts, sets the clock, or flashes firmware directly.

Firmware upload binary frames are permitted only inside an authenticated token-owned upload session. Validation is asynchronous and recovered through `firmware_upload_status`.

Every request name used by the UI must appear in configd’s WebSocket dispatcher. The builder’s UI/configd contract test verifies this parity.

The System panel polls `reset_button_status` every 500 ms while mounted. This lightweight response contains `reset_button` and `led_owner`; it deliberately avoids the expensive full inventory assembled by `get_status`. Press/release state is server-authoritative.

Identity and timezone controls use `system_identity_get`, `system_identity_set`, and `timezones_get`. The target is authoritative for hostname validation, mDNS reconfiguration, timezone definitions, and capabilities. Browser-local display/session preferences are listed in the builder management-feature manifest and deliberately excluded from PMC parity.
