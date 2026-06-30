# API module

`src/api.js` implements `ConfigdClient`, the reconnecting client for the configd WebSocket protocol.

```js
new ConfigdClient({ url, onStatus, onConfig, onConnection, onError })
```

`request(type, data)` assigns a unique string ID and resolves only from the matching response. Requests have a bounded timeout and all pending promises are rejected on disconnect. Malformed server JSON is reported without breaking reconnect. Correlated `error` responses reject the originating request; uncorrelated errors are forwarded to `onError`.

Connection state distinguishes transport, protocol handshake, authentication, and role. The client uses `configd-ws`, validates protocol `hello`, supports password and token authentication, and does not expose privileged operations until the server returns capabilities.

The System panel uses ordinary bounded `request()` calls for `reset_button_status` at 500 ms intervals. Polling is stopped when the panel unmounts, and transient failures are left to the global connection-state UI rather than producing repeated local error banners.
