export const PLACEMENT_PLANNER_RULES = `1. Never modify, move, or remove fixed CalendarBlocks from the input. They are immutable.
2. When cursorStartMinutes is provided, do not place any session or auxiliary block starting before it.
3. Use only taskId values from the input tasks array. Do not invent task IDs.
4. Sessions must not overlap each other, fixed blocks, or anchored sessions.
5. The sessions array length must not exceed capacityPlan.targetSessionCount.
6. Return JSON only. No markdown fences, prose, or commentary.
7. Always include reasonTags on the root PlacementResult and on every session.`;
