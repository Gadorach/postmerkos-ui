# Firmware, backup, and recovery interactions

## Firmware upload

The browser uploads a firmware object and optional matching JSON release manifest into a token-owned staging slot. Completing upload starts asynchronous server-side validation. The UI polls upload status and restores the active job after reconnect or page reload, so long validation does not require re-uploading the image.

Known-incompatible candidates remain blocked. Untested candidates require the exact acknowledgement returned by configd. Installation begins only after the candidate is ready and the administrator authorizes the final operation.

## Status indication

The UI reports updater state and explains that chassis LED patterns continue after the browser disconnects: alternating green/orange for progress, triple orange for failure/rollback, and solid green after verified success on supported hardware.

## Configuration backup and restore

Backup exports the supported configuration JSON without account password hashes, private keys, or session tokens. Restore submits a complete candidate to configd’s validate/apply/rollback transaction; the UI does not replace persistent files directly.

Hardware UART and pre-kernel recovery are host/console workflows and are not implemented in the browser.
