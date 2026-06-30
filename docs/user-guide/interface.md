# Current interface behavior

The browser uses configd as the sole configuration, validation, status, and authorization authority. Startup performs `configd-ws` negotiation, protocol `hello`, account authentication/token restoration, then role-filtered subscriptions.

The eight-card header exposes identity/runtime summary and the Legend, Update, Configuration, and Logout controls. Configuration contains System, Display, Network/Identity, Ports, Switching, Accounts/SSH keys, Time, Services, Monitoring, and Terminal.

Selecting a graphical port opens a focused editor. Phone mode uses collapsible card sections; larger layouts use the detailed grid. Desktop/tablet All Ports provides filtering, row selection, cloning, optional names, and Apply/Discard behavior. Phone mode disables that wide table and uses port selection instead.

Controls are filtered by authenticated capabilities, but configd independently enforces every request. Pending operations are correlated by ID and rejected on disconnect. The login status separates transport, handshake, authentication, and reconnect failures in one bounded panel.
