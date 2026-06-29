# System Information and time controls

## System Information

The System tab renders every available field from configd’s best-effort inventory in bounded sections:

- immutable device identity, hostname, serial, product number, and base MAC;
- firmware version, build/source data, schema/API versions, and compatibility evidence;
- processor/SoC, logical processor count, CPU capabilities, kernel release/build/architecture, and command line;
- uptime, boot time, load averages, and process counts;
- total/free/available RAM, cache, buffers, slab, and swap;
- root, overlay, config, and temporary filesystem capacity, free space, source, type, and options;
- MTD partition names, sizes, erase sizes, and total flash;
- temperatures, network state, service health, reset-button state/countdown, and chassis LED ownership/capability.

Missing optional sources are displayed as unavailable without hiding other sections.

## Time

The Time panel includes NTP enablement/servers, synchronization status, a grouped common-timezone selector, advanced standard-offset and recurring-DST controls, and manual local clock setting.

Manual input uses:

```text
HH:MM:SS - DD:MM:YYYY
```

Configd performs calendar and DST-gap validation and requires `services.manage`. The UI never performs its own privileged clock write.
