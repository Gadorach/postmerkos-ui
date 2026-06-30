# Login

The login page is one bounded card containing branding, username/password, **Remember me on this device**, Sign In, and a bounded connection-status panel.

Remember me persists only the authenticated session token in local storage; the password is never stored. Without it, the token is held in session storage. The checkbox preference itself survives refresh. Logout revokes the server session and clears both token stores.

Connection, protocol negotiation, readiness, authentication errors, reconnects, and session expiration share one normalized status panel with reserved height. Routine updates use `aria-live="polite"`, blocking failures use alert semantics, and detailed transport/protocol text is expandable. Fields use password-manager-compatible autocomplete attributes and mobile layouts remain scrollable above the virtual keyboard.
