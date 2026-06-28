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

// Legacy combined transport field — kept for backward compat with existing seed data.
// New code should use defaultMorningArrival / defaultAfternoonDismissal instead.
export const TRANSPORTATION_TYPE = v.union(
  v.literal("Bus"),
  v.literal("AfterCare"),
  v.literal("Carline"),
  v.literal("WalkUp"),
);

// ── Morning arrival options ───────────────────────────────────────────────────
export const MORNING_ARRIVAL = v.union(
  v.literal("Bus1"),
  v.literal("Bus2"),
  v.literal("Bus3"),
  v.literal("Bus4"),
  v.literal("Bus5"),
  v.literal("Bus6"),
  v.literal("Carline"),
  v.literal("BeforeCare"),
  v.literal("WalkIn"),
  v.literal("LateDropOff"),
  v.literal("NotExpected"),
);

// ── Afternoon dismissal options ───────────────────────────────────────────────
export const AFTERNOON_DISMISSAL = v.union(
  v.literal("Bus1"),
  v.literal("Bus2"),
  v.literal("Bus3"),
  v.literal("Bus4"),
  v.literal("Bus5"),
  v.literal("Bus6"),
  v.literal("Carline"),
  v.literal("AfterCare"),
  v.literal("EarlyPickup"),
  v.literal("NotExpected"),
);

// Walk-Up is a call source within Carline dismissal, not its own dismissal type.
// Carpool = Carline dismissal with a note/override.

export const ARRIVAL_TYPE = v.union(
  v.literal("Bus"),
  v.literal("Bus1"),
  v.literal("Bus2"),
  v.literal("Bus3"),
  v.literal("Bus4"),
  v.literal("Bus5"),
  v.literal("Bus6"),
  v.literal("Carline"),
  v.literal("BeforeCare"),
  v.literal("WalkIn"),
  v.literal("LateDropOff"),
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
  v.literal("unithead"),
);

export const PERIOD = v.union(
  v.literal("Period1"),
  v.literal("Period2"),
  v.literal("Period3"),
  v.literal("Period4"),
  v.literal("Period5"),
  v.literal("Period6"),
  v.literal("Period7"),
);

export const PERIOD_ASSIGNMENT = v.object({
  period: PERIOD,
  group: v.string(),
  activity: v.optional(v.string()),
});

export const ATTENDANCE_CHECKPOINT = v.union(
  // ── Morning arrival ──────────────────────────────────────────────────────
  v.literal("Arrival"),          // generic "arrived on campus"
  v.literal("MorningBusIn"),     // bus staff: camper is on the morning bus
  v.literal("MorningBusRoom"),   // bus room staff: camper arrived in JCC room
  v.literal("MorningBusSentToBunk"), // bus room releases camper toward bunk
  v.literal("BeforeCare"),       // before care check-in
  // ── Bunk ────────────────────────────────────────────────────────────────
  v.literal("BunkConfirm"),      // counselor confirms camper at bunk
  // ── Periods ─────────────────────────────────────────────────────────────
  v.literal("Period1"),
  v.literal("Period2"),
  v.literal("Period3"),
  v.literal("Period4"),
  v.literal("Period5"),
  v.literal("Period6"),
  v.literal("Period7"),
  // ── End-of-day bunk ─────────────────────────────────────────────────────
  v.literal("BunkSentToAfterCare"), // bunk releases camper toward After Care
  v.literal("BunkSentToBusRoom"),   // bunk releases camper toward Bus Room
  v.literal("LeftEarly"),           // early pickup / bunk out
  // ── Dismissal call ──────────────────────────────────────────────────────
  v.literal("Called"),           // called for carline/walkup
  v.literal("AssignedRunner"),
  v.literal("PickedUp"),
  // ── After Care ──────────────────────────────────────────────────────────
  v.literal("AfterCareIn"),      // after care staff: confirmed arrival
  v.literal("AfterCare"),        // generic after care checkpoint (legacy)
  v.literal("AfterCareOut"),     // camper left after care
  // ── Afternoon bus ───────────────────────────────────────────────────────
  v.literal("AfternoonBusRoomIn"),  // bus room staff: confirmed in bus room
  v.literal("AfternoonBusOnBoard"), // bus staff: boarded the bus
  v.literal("AfternoonBusAtStop"),  // reached stop (optional tracking)
  v.literal("Bus"),                 // generic bus checkpoint (legacy)
  // ── Other ───────────────────────────────────────────────────────────────
  v.literal("SentToBus"),           // legacy
  v.literal("SentToAfterCare"),     // legacy
  v.literal("Lunch"),
);

export const BUS_ROUTES = ["Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5", "Bus 6"] as const;

export default defineSchema({
  campers: defineTable({
    // ── Identity ─────────────────────────────────────────────────────────
    // `name` is the first name (or full display name for legacy records).
    // New imports should also populate preferredName and lastName separately.
    name: v.string(),
    preferredName: v.optional(v.string()),
    lastName: v.optional(v.string()),

    // ── Program placement ────────────────────────────────────────────────
    bunk: v.string(),
    unit: v.optional(v.string()),
    grade: v.optional(v.string()),
    campSection: v.optional(CAMP_SECTION),
    camp: v.optional(v.string()),         // e.g. "Kaleidoscope", "Swim", "Sports"
    campDivision: v.optional(v.string()), // sub-group within a camp, if applicable

    // ── Safety ──────────────────────────────────────────────────────────
    // `code` is the family pickup/safety code. Visible only to dismissal staff and admin.
    code: v.string(),

    // ── Flags ────────────────────────────────────────────────────────────
    hasAllergies: v.optional(v.boolean()),
    allergyDetails: v.optional(v.string()), // short allergy summary for counselors
    hasNotes: v.optional(v.boolean()),
    lunchInfo: v.optional(v.string()),      // blank = buys lunch, non-blank = what they bring

    // ── Default logistics (permanent plan, not date-scoped) ──────────────
    // These represent the camper's normal daily setup.
    defaultMorningArrival: v.optional(v.string()),   // MORNING_ARRIVAL value
    defaultAfternoonDismissal: v.optional(v.string()), // AFTERNOON_DISMISSAL value
    // Legacy single transport field — still read for backward compat
    transportationType: v.optional(TRANSPORTATION_TYPE),
    busRoute: v.optional(v.string()),   // "Bus 1".."Bus 6" for bus attendance sheets
    beforeCare: v.optional(v.boolean()),
    afterCare: v.optional(v.boolean()),

    // ── Week 0 simplified transport ─────────────────────────────────────
    arrivalMethod: v.optional(v.string()),     // e.g. "Carline", "Before Care", "Blue Bus"
    dismissalMethod: v.optional(v.string()),   // e.g. "Carline", "After Care", "Red Bus"

    // ── Bus-specific fields ─────────────────────────────────────────────
    busStop: v.optional(v.string()),
    walkPermission: v.optional(v.boolean()),

    // ── Camper notes (text drives the flag) ─────────────────────────────
    camperNotes: v.optional(v.string()),

    // ── Photo ────────────────────────────────────────────────────────────
    photoUrl: v.optional(v.string()),

    // ── Active status ─────────────────────────────────────────────────────
    isActive: v.optional(v.boolean()),

    // ── Live daily state (reset each morning via clearDailyState) ────────
    // These fields represent what has actually happened today.
    // They are intentionally reset at the start of each day.
    status: STATUS,
    callSource: v.optional(SOURCE),
    runner: v.optional(v.string()),
    note: v.optional(v.string()),
    tCalled: v.optional(v.number()),
    tAssigned: v.optional(v.number()),
    tPickedUp: v.optional(v.number()),
    tDismissed: v.optional(v.number()),

    arrivalStatus: v.optional(v.union(v.literal("NotArrived"), v.literal("Arrived"), v.literal("Absent"))),
    arrivalType: v.optional(ARRIVAL_TYPE),
    bunkConfirmed: v.optional(v.boolean()),
    leftEarly: v.optional(v.boolean()),
    tLeftEarly: v.optional(v.number()),
    attendanceNote: v.optional(v.string()),

    // Period schedule (static) and daily attendance (reset each day)
    periodGroups: v.optional(v.record(v.string(), v.string())),
    periodAttendance: v.optional(v.record(v.string(), v.string())),

    // Generic per-day checkpoints
    dailyCheckpoints: v.optional(v.record(v.string(), v.boolean())),
    dailyCheckpointsOut: v.optional(v.record(v.string(), v.boolean())),

    // ── Embedded daily flags (DEPRECATED — new writes go to dailyOverrides) ─
    // These are kept for backward compat with existing records.
    // The dailyOverrides table is the source of truth for date-scoped plans.
    lateDropoffTime: v.optional(v.string()),
    earlyPickupTime: v.optional(v.string()),
    dailyArrivalOverride: v.optional(v.string()),
    dailyDismissalOverride: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_runner", ["runner"])
    .index("by_bunk", ["bunk"])
    .index("by_unit", ["unit"]),

  // Staff members — each has a unique personal login code
  staff: defineTable({
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    code: v.string(),
    role: STAFF_ROLE,
    extraRoles: v.optional(v.array(STAFF_ROLE)),
    bunkAssignment: v.optional(v.string()),
    unitAssignment: v.optional(v.string()),
    campSection: v.optional(v.string()),
    busRoute: v.optional(v.string()),
    camp: v.optional(v.string()),
    division: v.optional(v.string()),
    primaryJob: v.optional(v.string()),
    secondaryJob: v.optional(v.string()),
    canBeRunner: v.optional(v.boolean()),
    runnerLabel: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    periodAssignments: v.optional(v.array(PERIOD_ASSIGNMENT)),
    groupAssignment: v.optional(v.string()),
    sectionScope: v.optional(v.array(v.string())),
  }).index("by_code", ["code"]),

  // ── Date-scoped daily overrides ───────────────────────────────────────────
  // Every one-day change (arrival, dismissal, late drop-off, early pickup,
  // absent flag, carpool note) lives here, keyed by camper + date.
  // These are NEVER wiped by clearDailyState — they survive across day rollovers.
  // Tomorrow's early pickup entered today will still be here tomorrow.
  dailyOverrides: defineTable({
    camperId:           v.id("campers"),
    date:               v.string(),           // "YYYY-MM-DD"
    morningArrival:     v.optional(v.string()),   // overrides defaultMorningArrival
    afternoonDismissal: v.optional(v.string()),   // overrides defaultAfternoonDismissal
    lateDropoffTime:    v.optional(v.string()),   // "HH:MM" 24h
    earlyPickupTime:    v.optional(v.string()),   // "HH:MM" 24h
    isAbsent:           v.optional(v.boolean()),
    note:               v.optional(v.string()),   // override note (e.g. "Going home with Smith family")
    status:             v.optional(v.string()),   // "active" | "cleared" — defaults to active
    createdBy:          v.string(),
    updatedBy:          v.optional(v.string()),
    createdAt:          v.number(),
    updatedAt:          v.optional(v.number()),
    clearedAt:          v.optional(v.number()),
    clearedBy:          v.optional(v.string()),
  })
    .index("by_camper_date", ["camperId", "date"])
    .index("by_date",        ["date"]),

  // Attendance exception resolutions — open exceptions are computed live;
  // this table only stores who resolved them and with what note.
  attendanceExceptions: defineTable({
    camperId:       v.id("campers"),
    date:           v.string(),
    exceptionType:  v.string(),
    resolvedBy:     v.string(),
    resolvedAt:     v.number(),
    resolutionNote: v.optional(v.string()),
  })
    .index("by_camper_date", ["camperId", "date"])
    .index("by_date",        ["date"]),

  // Immutable log of every attendance action
  attendanceLogs: defineTable({
    camperId:   v.id("campers"),
    date:       v.string(),
    checkpoint: ATTENDANCE_CHECKPOINT,
    status:     v.string(),
    staffName:  v.string(),
    timestamp:  v.number(),
  })
    .index("by_camper_date", ["camperId", "date"])
    .index("by_date",        ["date"]),

  // ── Permanent camp structure ─────────────────────────────────────────────
  // Admin-managed hierarchy: Camp → Division → Bunk.
  // Exists independently of camper uploads.
  campStructure: defineTable({
    camp: v.string(),
    division: v.string(),
    bunk: v.string(),
    displayName: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    defaultLocation: v.optional(v.string()),
    dismissalLocation: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.string())),
  })
    .index("by_camp", ["camp"])
    .index("by_bunk", ["bunk"])
    .index("by_camp_division", ["camp", "division"]),

  // ── Staff assignments (many-per-staff) ───────────────────────────────────
  staffAssignments: defineTable({
    staffId: v.id("staff"),
    type: v.union(
      v.literal("bunk"),
      v.literal("period"),
      v.literal("lunch"),
      v.literal("dismissal"),
      v.literal("bus"),
      v.literal("beforecare"),
      v.literal("aftercare"),
    ),
    camp: v.optional(v.string()),
    division: v.optional(v.string()),
    bunk: v.optional(v.string()),
    period: v.optional(v.string()),
    className: v.optional(v.string()),
    busRoute: v.optional(v.string()),
    dismissalRole: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  })
    .index("by_staff", ["staffId"])
    .index("by_type", ["type"])
    .index("by_bunk", ["bunk"])
    .index("by_period_class", ["period", "className"]),

  // ── Period schedules (camper → period/class) ─────────────────────────────
  periodSchedules: defineTable({
    camperId: v.id("campers"),
    period: v.string(),
    className: v.string(),
    room: v.optional(v.string()),
  })
    .index("by_camper", ["camperId"])
    .index("by_period_class", ["period", "className"]),

  // ── Lunch records (daily, created from weekly upload) ─────────────────────
  lunchRecords: defineTable({
    camperId: v.id("campers"),
    weekStartDate: v.string(),
    date: v.string(),
    lunchType: v.union(v.literal("regular"), v.literal("alternate")),
    pickedUp: v.optional(v.boolean()),
    pickedUpAt: v.optional(v.number()),
    pickedUpByStaffId: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_camper_date", ["camperId", "date"])
    .index("by_week", ["weekStartDate"]),

  // ── Period attendance records (daily check-in per period/class) ──────────
  periodAttendanceRecords: defineTable({
    camperId: v.id("campers"),
    date: v.string(),
    period: v.string(),
    className: v.string(),
    checkedIn: v.optional(v.boolean()),
    checkedInAt: v.optional(v.number()),
    checkedInByStaffId: v.optional(v.string()),
  })
    .index("by_camper_date", ["camperId", "date"])
    .index("by_period_class_date", ["period", "className", "date"]),
});
