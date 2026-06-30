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
- temperatures, network state, service health, debounced reset-button press/release/arming/countdown state, and chassis LED ownership/capability;
- persistent-overlay recovery mode when writable JFFS2 is unavailable.

Missing optional sources are displayed as unavailable without hiding other sections. The physical reset card uses a dedicated 500 ms status request, so a release and countdown cancellation appear without waiting for the full-system status interval. If the switch has entered a RAM-backed overlay recovery mode, the panel warns that changes will not survive reboot.

## Time

The Time panel includes NTP enablement/servers, synchronization status, a grouped common-timezone selector, advanced standard-offset and recurring-DST controls, and manual local clock setting.

Manual input uses:

```text
HH:MM:SS - DD:MM:YYYY
```

Configd performs calendar and DST-gap validation and requires `services.manage`. The UI never performs its own privileged clock write.
