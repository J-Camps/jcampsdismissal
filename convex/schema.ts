import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const STATUS = v.union(
  v.literal("Waiting"),
  v.literal("Called"),
  v.literal("Assigned"),
  v.literal("Picked Up"),
  v.literal("Dismissed"),
);

export const SOURCE = v.union(v.literal("Carline"), v.literal("Walk-Up"));

export const ATTENDANCE_STATUS = v.union(
  v.literal("Present"),
  v.literal("Absent"),
  v.literal("Expected Late"),
  v.literal("Dismissed Early"),
  v.literal("Already Dismissed"),
);

export const LUNCH_TYPE = v.union(v.literal("Bought"), v.literal("Brought"));

export const DISMISSAL_ROUTE = v.union(
  v.literal("Bus"),
  v.literal("Carline"),
  v.literal("AfterCare"),
);

export const MORNING_ROUTE = v.union(
  v.literal("Bus"),
  v.literal("Carline"),
  v.literal("WalkUp"),
  v.literal("BeforeCare"),
);

export const MORNING_STAGE = v.union(
  v.literal("NotArrived"),
  v.literal("BoardedBus"),
  v.literal("AtJCC"),
  v.literal("BeforeCareIn"),
  v.literal("SentToBunk"),
  v.literal("Confirmed"),
);

export default defineSchema({
  campers: defineTable({
    name: v.string(),
    bunk: v.string(),
    code: v.string(),
    status: STATUS,
    callSource: v.optional(SOURCE),
    runner: v.optional(v.string()),
    note: v.optional(v.string()),
    tCalled: v.optional(v.number()),
    tAssigned: v.optional(v.number()),
    tPickedUp: v.optional(v.number()),
    tDismissed: v.optional(v.number()),
    attendanceStatus: v.optional(ATTENDANCE_STATUS),

    // Attendance + dismissal redesign
    lunchType: v.optional(LUNCH_TYPE),
    dismissalRoute: v.optional(DISMISSAL_ROUTE),
    dismissalRouteOverride: v.optional(DISMISSAL_ROUTE),
    morningRoute: v.optional(MORNING_ROUTE),
    busRoute: v.optional(v.string()),
    morningStage: v.optional(MORNING_STAGE),
    tMorningStage: v.optional(v.number()),
    sentToBus: v.optional(v.boolean()),
    sentToAfterCare: v.optional(v.boolean()),
    afterCareConfirmed: v.optional(v.boolean()),
    earlyDismissal: v.optional(v.boolean()),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_runner", ["runner"])
    .index("by_bunk", ["bunk"])
    .index("by_busRoute", ["busRoute"]),
});
