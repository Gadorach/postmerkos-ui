# API module

`src/api.js` implements `ConfigdClient`, a transport-neutral client model around the configd WebSocket protocol.

## Inputs

```js
new ConfigdClient({ url, onStatus, onConfig, onConnection, onError })
```

`request(type, data)` adds a unique string ID and returns a promise resolved by the matching response. Requests time out after ten seconds. Pending promises are rejected on disconnect.

Malformed server JSON is reported without breaking the reconnect loop. `error` responses reject only the matching request; uncorrelated errors are passed to `onError`.
