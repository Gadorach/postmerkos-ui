# Third-party merge repair — 2026-06-27

This repair removes the duplicate SSH-key component declarations that prevented
Vite from building and restores a mandatory lint/test/production-build CI gate.

Firmware upload handling now follows configd's asynchronous validator. The UI
polls the durable server-side job, tolerates reconnects and lost finish replies,
recovers validating or ready images after a page reload, and distinguishes a
lost staged upload from a slow validation job.

Monitoring settings now expose the management-interface restriction for SNMP
and Prometheus and clearly warn when either listener is intentionally exposed on
all Linux interfaces. Missing browser globals were also added to the ESLint
environment so lint can remain a release gate.
