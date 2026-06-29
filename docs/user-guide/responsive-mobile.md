# Responsive and mobile layout

Configuration content uses bounded Accounts-style card stacks. Normal dialogs stop growing when their task is readable; Terminal and All Ports use wider limits. Cards, forms, status grids, and actions collapse to one column as available width decreases.

## Front-panel wrapping

Copper ports are partitioned into banks of 12. All SFP ports remain one visual bank with the same wrapping priority as a twelve-port bank. Flex order causes wrapping in this sequence:

1. SFP bank;
2. highest-numbered copper bank;
3. next-highest copper bank;
4. continuing toward the first bank.

Normal banks use a switch-face grid. When that grid cannot fit, each bank changes to two columns and grows vertically instead of creating a horizontal page scrollbar.

## All Ports

The desktop floating header uses measured row height and a one-pixel overlap so scrolled rows cannot show through between sticky header sections. Mobile mode disables obstructive sticky table behavior and uses controls sized for touch.

## Mobile interaction

Small screens receive near-full-screen dialogs, wrapped tab navigation, touch-sized inputs/buttons, stacked action rows, single-column forms/status cards, non-sticky port tables, compact filters, usable terminal controls, and notifications that do not cover primary actions.
