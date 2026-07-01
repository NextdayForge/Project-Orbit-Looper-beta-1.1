# Legacy code (not used by current app)

This folder contains **v1 Event-based scheduling code** that is **not imported** by `src/App.tsx` or the Architecture v1.1 stack.

## Contents

| Path | Description |
|---|---|
| `hooks/useCalendarState.ts` | Old monolithic calendar hook |
| `services/*` | `aiService`, `schedulePlanner`, `scheduleOptimizer`, `storage` (Event model) |
| `vol.1/` | Archived copy of the pre-migration Expo app |

## Current app entry

- `index.ts` → `src/App.tsx`
- Data: `repositories/*` → `storage/OrbitDataStore` (Task / Session / CalendarBlock)

Do not import from `legacy/` in active `src/` code.
