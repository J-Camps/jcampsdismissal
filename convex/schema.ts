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
  v.literal("Lower"),
  v.literal("Middle"),
  v.literal("Upper"),
  v.literal("CIT"),
  v.literal("Swim"),
  v.literal("Sports"),
  v.literal("Tennis"),
  v.literal("Specialty"),
);

export const STAFF_ROLE = v.union(
  v.literal("counselor"),
  v.literal("specialist"),
  v.literal("carline"),
  v.literal("walkup"),
  v.literal("dispatcher"),
  v.literal("runner"),
  v.literal("director"),
  v.literal("admin"),
  v.literal("beforecare"),
  v.literal("aftercare"),
  v.literal("bus"),
  v.literal("lunch"),
);

export const PERIOD = v.union(
  v.literal("Period1"),
  v.literal("Period2"),
  v.literal("Period3"),
  v.literal("Period4"),
  v.literal("Period5"),
  v.literal("Period6"),
);

// A staff member's assignment to a specific activity group during a period
// (used for Upper Camp specialists, and Upper Camp counselors who also run a period).
export const PERIOD_ASSIGNMENT = v.object({
  period: PERIOD,
  group: v.string(),       // e.g. "Swim - Beginners", "Arts & Crafts A"
  activity: v.optional(v.string()), // human-friendly activity name shown in the UI
});

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
  v.literal("LeftEarly"),
  v.literal("BeforeCare"),
  v.literal("AfterCare"),
  v.literal("Lunch"),
  v.literal("Bus"),
);

// The 6 bus attendance sheets, used for the "bus" staff role
export const BUS_ROUTES = ["Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5", "Bus 6"] as const;

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
    campSection: v.optional(CAMP_SECTION), // Lower | Middle | Upper | CIT | Swim | Sports | Tennis | Specialty

    // ── flag fields ──
    hasAllergies: v.optional(v.boolean()),
    hasNotes: v.optional(v.boolean()),
    lunchInfo: v.optional(v.string()),

    // ── logistics ──
    transportationType: v.optional(TRANSPORTATION_TYPE),
    busRoute: v.optional(v.string()),     // e.g. "Bus 1".."Bus 6" — for bus attendance sheets
    beforeCare: v.optional(v.boolean()),  // enrolled in Before Care
    afterCare: v.optional(v.boolean()),   // enrolled in After Care

    // ── photo ──
    photoUrl: v.optional(v.string()),

    // ── daily attendance (reset each day) ──
    arrivalStatus: v.optional(v.union(v.literal("NotArrived"), v.literal("Arrived"), v.literal("Absent"))),
    arrivalType: v.optional(ARRIVAL_TYPE),
    bunkConfirmed: v.optional(v.boolean()),
    leftEarly: v.optional(v.boolean()),
    tLeftEarly: v.optional(v.number()),
    attendanceNote: v.optional(v.string()),

    // ── Upper Camp period schedule (reset each day is not needed — schedule is static) ──
    // Maps period -> activity group name, e.g. { Period1: "Swim - Beginners", Period3: "Arts & Crafts A" }
    periodGroups: v.optional(v.record(v.string(), v.string())),
    // Per-period attendance for the day, e.g. { Period1: "Present", Period3: "Absent" }
    periodAttendance: v.optional(v.record(v.string(), v.string())),

    // Generic per-day checkpoint check-offs, e.g. { BeforeCare: true, Lunch: true, Bus: true }
    dailyCheckpoints: v.optional(v.record(v.string(), v.boolean())),
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
    // Primary role (shown in header). Kept for backward compat.
    role: STAFF_ROLE,
    // Additional roles a single staff code grants access to.
    // E.g. a counselor who also runs Before Care and is a runner:
    //   role: "counselor", extraRoles: ["beforecare", "runner"]
    extraRoles: v.optional(v.array(STAFF_ROLE)),
    bunkAssignment: v.optional(v.string()), // for counselors
    runnerLabel: v.optional(v.string()),    // for runners, e.g. "Runner 1"
    // For specialists, and Upper Camp counselors who also run a period activity group
    periodAssignments: v.optional(v.array(PERIOD_ASSIGNMENT)),
    // For bus / before-care / after-care staff — which group they run, e.g. "Bus 3"
    groupAssignment: v.optional(v.string()),
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
