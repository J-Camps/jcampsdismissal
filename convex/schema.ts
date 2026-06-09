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

export const TRANSPORTATION_TYPE = v.union(
  v.literal("Bus"),
  v.literal("AfterCare"),
  v.literal("Carline"),
  v.literal("WalkUp"),
);

export const ARRIVAL_TYPE = v.union(
  v.literal("Bus"),
  v.literal("Carline"),
  v.literal("BeforeCare"),
  v.literal("WalkIn"),
  v.literal("Director"),
);

export const CAMP_SECTION = v.union(
  v.literal("Upper"),
  v.literal("Lower"),
);

export const STAFF_ROLE = v.union(
  v.literal("counselor"),
  v.literal("carline"),
  v.literal("walkup"),
  v.literal("dispatcher"),
  v.literal("runner"),
  v.literal("director"),
  v.literal("admin"),
);

export const ATTENDANCE_CHECKPOINT = v.union(
  v.literal("Arrival"),
  v.literal("BunkConfirm"),
  v.literal("Period1"),
  v.literal("Period2"),
  v.literal("Period3"),
  v.literal("Period4"),
  v.literal("Period5"),
  v.literal("Period6"),
  v.literal("Called"),
  v.literal("AssignedRunner"),
  v.literal("PickedUp"),
  v.literal("SentToBus"),
  v.literal("SentToAfterCare"),
);

export default defineSchema({
  campers: defineTable({
    // ── existing fields (unchanged) ──
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

    // ── new identity fields ──
    preferredName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    unit: v.optional(v.string()),
    grade: v.optional(v.string()),
    campSection: v.optional(CAMP_SECTION), // "Upper" | "Lower"

    // ── flag fields ──
    hasAllergies: v.optional(v.boolean()),
    hasNotes: v.optional(v.boolean()),
    lunchInfo: v.optional(v.string()),

    // ── logistics ──
    transportationType: v.optional(TRANSPORTATION_TYPE),

    // ── daily attendance (reset each day) ──
    arrivalStatus: v.optional(v.union(v.literal("NotArrived"), v.literal("Arrived"))),
    arrivalType: v.optional(ARRIVAL_TYPE),
    bunkConfirmed: v.optional(v.boolean()),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_runner", ["runner"])
    .index("by_bunk", ["bunk"])
    .index("by_unit", ["unit"]),

  // Staff members — each has a unique personal login code
  staff: defineTable({
    name: v.string(),
    code: v.string(),
    role: STAFF_ROLE,
    bunkAssignment: v.optional(v.string()), // for counselors
    runnerLabel: v.optional(v.string()),    // for runners, e.g. "Runner 1"
  }).index("by_code", ["code"]),

  // Immutable log of every attendance action
  attendanceLogs: defineTable({
    camperId: v.id("campers"),
    date: v.string(),          // "YYYY-MM-DD"
    checkpoint: ATTENDANCE_CHECKPOINT,
    status: v.string(),
    staffName: v.string(),
    timestamp: v.number(),
  })
    .index("by_camper_date", ["camperId", "date"])
    .index("by_date", ["date"]),
});
