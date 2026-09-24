# NEXORA Executive Dashboard

## Goal
Replace the dashboard placeholder with a polished, responsive executive overview that surfaces the requested financial, customer, order, inventory, activity, transaction, and task signals without implementing the underlying business modules.

## What will be built
- A concise dashboard header with organization context, reporting period, and an explicit demo-data indicator.
- Seven executive KPI tiles: Revenue, Expenses, Net income, Orders, Customers, Inventory alerts, and Pending tasks.
- A primary revenue trend chart with period comparison and accessible tooltip/summary information.
- A complementary expense chart showing expense movement and category mix.
- Scannable panels for recent activity, low-inventory alerts, recent transactions, and pending tasks.
- Responsive layouts optimized for desktop, tablet, and mobile, preserving the existing sidebar, header, theme modes, and permission system.

## Data architecture
- Define typed dashboard data models and a single data-access hook/provider boundary.
- Keep realistic demo fixtures separate from presentation components so live Lovable Cloud queries can replace them later without redesigning the page.
- Mark demo values clearly and avoid creating Sales or Inventory workflows, editable records, or unnecessary database tables.
- Use a six-month USD reporting view as the initial demo context.

## Technical details
- Reuse the existing Recharts/shadcn chart primitives, semantic design tokens, Buttons, and accessibility patterns.
- Add small focused dashboard components for KPI tiles, chart panels, list/table rows, status indicators, and empty/loading/error states.
- Preserve the existing `/dashboard` route metadata and RBAC gate; no application-shell rebuild.
- Ensure chart colors, alert states, and positive/negative trends remain legible in light and dark themes and do not rely on color alone.

## Verification
- Check the dashboard at desktop and mobile widths in both themes.
- Verify no overflow, overlap, inaccessible controls, or console/runtime errors.
- Run the focused type/build checks and confirm the preview build is healthy.
