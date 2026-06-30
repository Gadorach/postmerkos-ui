# System Information, identity, and time

## System Information

The System tab renders every available configd field in bounded sections: immutable device identity, configured/effective hostname, requested `.local` name and verification state, release/source/API data, CPU/kernel, uptime/load/processes, RAM, mounted storage, MTD layout, temperatures, network/services, reset state/LED ownership, compatibility, and persistent-overlay recovery mode.

Missing optional sources do not hide unrelated sections. Reset state uses a dedicated lightweight 500 ms request rather than waiting for the full status interval.

## System identity and discovery

Network includes a **System Identity & Discovery** card. The default hostname is `postmerkos`, yielding `postmerkos.local`. Administrators can enter a validated custom label, restore the default, or generate a MAC-derived unique label. mDNS is management-only and ordinary central DNS registration is not implied.

## Time

The Time panel loads the canonical target-side timezone catalogue and retains the bundled list only as a connection fallback. Selecting a zone fills compact standard-offset and recurring-DST policy. NTP state and advanced rules remain editable. Manual local time uses `HH:MM:SS - DD:MM:YYYY`; configd performs calendar/DST validation and requires `services.manage`.
