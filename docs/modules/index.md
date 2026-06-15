# Application module

`src/index.jsx` owns confirmed configuration, editable configuration, runtime status, computed delta, connection state, and upload feedback.

Only the delta is sent to configd. No UI-only metadata is added to the persistent configuration. After acknowledgement, configd broadcasts the complete saved configuration and the UI replaces its local confirmed state.

Nested changes use immutable copies so a one-field update does not mutate the last confirmed object.
