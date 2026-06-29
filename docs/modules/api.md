# API module

`src/api.js` implements `ConfigdClient`, the reconnecting client for the configd WebSocket protocol.

```js
new ConfigdClient({ url, onStatus, onConfig, onConnection, onError })
```

`request(type, data)` assigns a unique string ID and resolves only from the matching response. Requests have a bounded timeout and all pending promises are rejected on disconnect. Malformed server JSON is reported without breaking reconnect. Correlated `error` responses reject the originating request; uncorrelated errors are forwarded to `onError`.

Connection state distinguishes transport, protocol handshake, authentication, and role. The client uses `configd-ws`, validates protocol `hello`, supports password and token authentication, and does not expose privileged operations until the server returns capabilities.
