# Changelog

## [2026.06.29-docs] - 2026-06-29

### Changed

- Made `docs/README.md` the current interface documentation database.
- Reduced the root README to development onboarding and documentation links.
- Added current user guides for responsive/mobile behavior, System Information, time, firmware upload, and backup/restore.
- Added repository documentation rules and an automated documentation check.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2026.06.29] - 2026-06-29

### Added

- Local Linux account login and password management.
- Browser firmware upload and updater status.
- Authenticated bounded command window.
- Plain JSON backup and restore.
- Click-to-scroll port navigation and hover summaries.
- Persistent unapplied-change notification with Apply and Discard actions.

### Changed

- Refresh the Vite and WebSocket development dependency lockfile to a zero-advisory audit.
- Preserve desired nested PoE/VLAN/STP state when runtime link status is merged.
- Keep all port controls editable while physical link is down.
- Remove backup encryption and browser crypto dependencies for a smaller firmware image.

## [0.6.0] - 2026-02-26

Websockets and polling, oh my!

### Breaking

- dropped CGI scripts in favor of a websocket connection

### Fixed

- Switch status wins over config file when merging
- PoE status indicator is being displayed again

### Changed

- simplified VLAN config fields

### Added

- inline help text


## [0.5.1] - 2026-02-07

An even further reduction in zip size to `11.9 KB`!

### Changed

- Use toggle boxes instead of radio buttons

### Added

- Link back to repo in header

### Removed

- Removed test files from published artifact
- Removed boilerplate icon files and PWA functionality

## [0.5.0] - 2026-02-07

A reduction in final zip size from `250 KB` to `72.2 KB`.

### Changed

- Migrate from `preact-cli` to `vite`
- Replace `react-modal`, `axios`, and `lodash` with native APIs
- Convert class components to functional components
- Use `nix` in CI workflow

## [0.4.0] - 2023-02-09

### Removed

- Unused lighttpd configuration

## [0.3.2] - 2023-02-09

### Changed

- Use nord theme for softer color palette

## [0.3.1] - 2023-02-09

### Changed

- Simplify and cleanup table layout

## [0.3.0] - 2023-02-09

### Changed

- Grey-out rows of ports which aren't established
