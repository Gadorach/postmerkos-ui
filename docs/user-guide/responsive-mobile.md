# Responsive and mobile layout

Configuration content uses bounded Accounts-style card stacks. Normal dialogs stop growing when their task is readable; Terminal and All Ports use wider task-specific limits.

## Header

The top display has eight cards: Branding/Firmware, Device, Address, Time, Temperatures, Session, Tools, and Account. Desktop uses an eight-column row and wraps complete cards when needed, tablet uses four columns, and phone uses eight centered single-column rows with enlarged text/icons/touch targets.

## Front-panel wrapping

Desktop/tablet copper ports use labelled 12-port 2×6 fieldsets. Exact-model metadata labels the grouped uplinks `SFP`, `SFP+`, or `SFP/SFP+`. Groups wrap before clipping and each row is centered. At 1920 pixels, the highest model fits four copper banks and one four-port uplink bank in one row.

Phone mode divides copper into labelled six-port 2×3 groups and scales them to the usable width. Uplinks remain two-port atomic pairs; four uplinks span the same width as three copper graphics. Aspect ratios are preserved. Vertical tile borders collapse by one pixel, while horizontal row borders remain distinct.

## Mobile editing and All Ports

The main-page All Ports option is always suppressed on phones without deleting the saved desktop preference. Configuration → Ports becomes a numbered selector. A selected phone port opens accordion sections for Overview, Basic Settings, PoE, VLAN, Spanning Tree, and Clients, with every setting in an individual full-width card.

Desktop/tablet All Ports is an outlined panel with row selection, cloning, filters, and optional names. Names are collapsed by default and only the port-number column remains pinned. The measured sticky headers overlap by one pixel so scrolling content cannot show through a seam.
