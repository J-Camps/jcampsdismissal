import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

// ─── Queries ────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("campers").collect();
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("campers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .collect();
  },
});

export const active = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    return all.filter((c) => c.status === "Called" || c.status === "Assigned");
  },
});

export const forRunner = query({
  args: { runner: v.string() },
  handler: async (ctx, { runner }) => {
    const mine = await ctx.db
      .query("campers")
      .withIndex("by_runner", (q) => q.eq("runner", runner))
      .collect();
    return mine.filter((c) => c.status !== "Dismissed");
  },
});

export const getBunkRoster = query({
  args: { bunk: v.string() },
  handler: async (ctx, { bunk }) => {
    return await ctx.db
      .query("campers")
      .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
      .collect();
  },
});

export const getBunks = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    return [...new Set(all.map((c) => c.bunk))].sort();
  },
});

// All campers enrolled in Before Care
export const getBeforeCareRoster = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    return all.filter((c) => c.beforeCare);
  },
});

// All campers enrolled in After Care
export const getAfterCareRoster = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    return all.filter((c) => c.afterCare);
  },
});

// All campers assigned to a given bus route (one of the 6 bus attendance sheets)
export const getBusRoster = query({
  args: { route: v.string() },
  handler: async (ctx, { route }) => {
    const all = await ctx.db.query("campers").collect();
    return all.filter((c) => c.busRoute === route);
  },
});

// All campers who buy lunch (no lunchInfo set means they buy rather than bring).
// Used by the lunch distributor view to track who has picked up their bought lunch.
export const getLunchBuyers = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    return all.filter((c) => !c.lunchInfo?.trim());
  },
});

// All campers scheduled into a given activity group during a given period
export const getPeriodRoster = query({
  args: { period: v.string(), group: v.string() },
  handler: async (ctx, { period, group }) => {
    const all = await ctx.db.query("campers").collect();
    return all.filter((c) => c.periodGroups?.[period] === group);
  },
});

// ─── Existing Mutations ──────────────────────────────────────────────────────

export const callByCode = mutation({
  args: { code: v.string(), source: v.union(v.literal("Carline"), v.literal("Walk-Up")) },
  handler: async (ctx, { code, source }) => {
    const matches = await ctx.db
      .query("campers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .collect();
    for (const c of matches) {
      if (c.status === "Waiting") {
        await ctx.db.patch(c._id, { status: "Called", callSource: source, tCalled: Date.now() });
        await ctx.db.insert("attendanceLogs", {
          camperId: c._id,
          date: today(),
          checkpoint: "Called",
          status: `Called via ${source}`,
          staffName: source,
          timestamp: Date.now(),
        });
      }
    }
  },
});

export const assign = mutation({
  args: { id: v.id("campers"), runner: v.string() },
  handler: async (ctx, { id, runner }) => {
    await ctx.db.patch(id, { status: "Assigned", runner, tAssigned: Date.now() });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "AssignedRunner",
      status: `Assigned to ${runner}`,
      staffName: "Dispatcher",
      timestamp: Date.now(),
    });
  },
});

export const cancelCall = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      status: "Waiting", callSource: undefined, runner: undefined,
      tCalled: undefined, tAssigned: undefined,
    });
  },
});

export const pickUp = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "Picked Up", tPickedUp: Date.now() });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "PickedUp",
      status: "Picked up",
      staffName: "Runner",
      timestamp: Date.now(),
    });
  },
});

export const dismiss = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "Dismissed", tDismissed: Date.now() });
  },
});

// Clear live daily state for all campers to start a fresh day.
// IMPORTANT: this does NOT touch the dailyOverrides table.
// Future-dated overrides (tomorrow's early pickup, late drop-off, carpool notes, etc.)
// survive this reset and will be applied correctly on their target date.
// The embedded legacy override fields (lateDropoffTime, earlyPickupTime,
// dailyArrivalOverride, dailyDismissalOverride) are also cleared here because
// they are same-day fields only — date-scoped plans belong in dailyOverrides.
export const clearDailyState = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    for (const c of all) {
      await ctx.db.patch(c._id, {
        status: "Waiting",
        callSource: undefined,
        runner: undefined,
        note: undefined,
        tCalled: undefined,
        tAssigned: undefined,
        tPickedUp: undefined,
        tDismissed: undefined,
        arrivalStatus: undefined,
        arrivalType: undefined,
        bunkConfirmed: undefined,
        leftEarly: undefined,
        tLeftEarly: undefined,
        attendanceNote: undefined,
        periodAttendance: undefined,
        dailyCheckpoints: undefined,
        dailyCheckpointsOut: undefined,
        // Legacy embedded override fields — cleared on rollover.
        // New override writes go to the dailyOverrides table instead.
        lateDropoffTime: undefined,
        earlyPickupTime: undefined,
        dailyArrivalOverride: undefined,
        dailyDismissalOverride: undefined,
      });
    }
  },
});

// Alias for backward compat — prefer clearDailyState in new code.
export const resetDay = clearDailyState;

// ─── New Attendance Mutations ────────────────────────────────────────────────

export const updateArrival = mutation({
  args: {
    id: v.id("campers"),
    arrivalType: v.union(
      v.literal("Bus"),
      v.literal("Carline"),
      v.literal("BeforeCare"),
      v.literal("WalkIn"),
      v.literal("Director"),
    ),
    staffName: v.string(),
  },
  handler: async (ctx, { id, arrivalType, staffName }) => {
    await ctx.db.patch(id, { arrivalStatus: "Arrived", arrivalType });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "Arrival",
      status: `Arrived via ${arrivalType}`,
      staffName,
      timestamp: Date.now(),
    });
  },
});

export const confirmWithBunk = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    const camper = await ctx.db.get(id);
    if (!camper) return;

    const patch: Record<string, unknown> = { bunkConfirmed: true, arrivalStatus: "Arrived" };

    // Auto-handoff: if camper came from Before Care, mark them as sent-to-bunk there too.
    if (camper.dailyCheckpoints?.BeforeCare && !camper.dailyCheckpointsOut?.BeforeCare) {
      patch.dailyCheckpointsOut = { ...(camper.dailyCheckpointsOut ?? {}), BeforeCare: true };
    }

    await ctx.db.patch(id, patch);
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "BunkConfirm",
      status: "Confirmed with bunk",
      staffName,
      timestamp: Date.now(),
    });
  },
});

export const unconfirmWithBunk = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { bunkConfirmed: false });
  },
});

// Mark a camper absent for the day (counselor)
export const markAbsent = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    await ctx.db.patch(id, { arrivalStatus: "Absent", bunkConfirmed: false });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "Arrival",
      status: "Marked absent",
      staffName,
      timestamp: Date.now(),
    });
  },
});

// Reset a single camper's morning status back to "Not Checked In"
export const resetMorningStatus = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      arrivalStatus: undefined,
      bunkConfirmed: false,
      leftEarly: undefined,
      tLeftEarly: undefined,
    });
  },
});

// Camper checked in earlier but has now left for the day (still "out")
export const markLeftEarly = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    const camper = await ctx.db.get(id);
    if (!camper) return;

    const patch: Record<string, unknown> = { leftEarly: true, tLeftEarly: Date.now() };

    // Auto-handoff: when bunk marks a camper out, auto-check them into their next location.
    const dismissal = camper.dailyDismissalOverride ?? camper.transportationType;
    const goesToAC  = camper.afterCare || dismissal === "AfterCare";
    const goesToBus = !goesToAC && dismissal === "Bus";

    if (goesToAC && !camper.dailyCheckpoints?.AfterCare) {
      // Arrive at After Care automatically
      patch.dailyCheckpoints = { ...(camper.dailyCheckpoints ?? {}), AfterCare: true };
    }
    if (goesToBus && !camper.dailyCheckpoints?.Bus) {
      // Arrive at Bus Room automatically
      patch.dailyCheckpoints = { ...(camper.dailyCheckpoints ?? {}), Bus: true };
    }

    await ctx.db.patch(id, patch);
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "LeftEarly",
      status: goesToAC ? "Left bunk → auto-checked into After Care"
             : goesToBus ? "Left bunk → auto-checked into Bus Room"
             : "Left bunk",
      staffName,
      timestamp: Date.now(),
    });
  },
});

// ── Destination-specific bunk release mutations ─────────────────────────────
// These replace the generic markLeftEarly for explicit bunk-out flows.
// Each creates the correct checkpoint and sets the right flags so exception
// logic can detect missing handoff confirmations.

export const releaseToAfterCare = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    const camper = await ctx.db.get(id);
    if (!camper) return;
    await ctx.db.patch(id, {
      leftEarly: true,
      tLeftEarly: Date.now(),
    });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "BunkSentToAfterCare",
      status: "Released from bunk → sent to After Care",
      staffName,
      timestamp: Date.now(),
    });
  },
});

export const releaseToBusRoom = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    const camper = await ctx.db.get(id);
    if (!camper) return;
    await ctx.db.patch(id, {
      leftEarly: true,
      tLeftEarly: Date.now(),
      dailyCheckpointsOut: { ...(camper.dailyCheckpointsOut ?? {}), Bus: true },
    });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "BunkSentToBusRoom",
      status: "Released from bunk → sent to Bus Room",
      staffName,
      timestamp: Date.now(),
    });
  },
});

export const releaseToRunner = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    await ctx.db.patch(id, {
      leftEarly: true,
      tLeftEarly: Date.now(),
    });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "LeftEarly",
      status: "Released from bunk → runner/carline pickup",
      staffName,
      timestamp: Date.now(),
    });
  },
});

export const releaseEarlyPickup = mutation({
  args: { id: v.id("campers"), staffName: v.string() },
  handler: async (ctx, { id, staffName }) => {
    await ctx.db.patch(id, {
      leftEarly: true,
      tLeftEarly: Date.now(),
    });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: "LeftEarly",
      status: "Released from bunk → early pickup",
      staffName,
      timestamp: Date.now(),
    });
  },
});

// Undo a "left early" mark — camper is back / still here
export const undoLeftEarly = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { leftEarly: false, tLeftEarly: undefined });
  },
});

// ── Admin daily flags ─────────────────────────────────────────────────────

// Toggle a camper Absent for the day (admin office flag, set before camp).
export const setAbsent = mutation({
  args: { id: v.id("campers"), absent: v.boolean(), staffName: v.string() },
  handler: async (ctx, { id, absent, staffName }) => {
    if (absent) {
      await ctx.db.patch(id, { arrivalStatus: "Absent", bunkConfirmed: false, leftEarly: false });
      await ctx.db.insert("attendanceLogs", {
        camperId: id, date: today(), checkpoint: "Arrival",
        status: "Marked absent", staffName, timestamp: Date.now(),
      });
    } else {
      const c = await ctx.db.get(id);
      if (c?.arrivalStatus === "Absent") await ctx.db.patch(id, { arrivalStatus: undefined });
    }
  },
});

// Late drop-off flag with arrival time ("HH:MM", empty string clears).
// Dual-writes: legacy camper field (for same-day display) + dailyOverrides (date-safe).
export const setLateDropoff = mutation({
  args: { id: v.id("campers"), time: v.string(), staffName: v.optional(v.string()) },
  handler: async (ctx, { id, time, staffName = "Admin" }) => {
    const val = time.trim() ? time.trim() : undefined;
    // Update legacy embedded field (still read by bunk row display)
    await ctx.db.patch(id, { lateDropoffTime: val });
    // Upsert into date-scoped table so future-day plans survive rollover
    const d = today();
    const existing = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", id).eq("date", d))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lateDropoffTime: val, updatedBy: staffName, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dailyOverrides", { camperId: id, date: d, lateDropoffTime: val, createdBy: staffName, createdAt: Date.now() });
    }
  },
});

// Early pickup flag with pickup time ("HH:MM", empty string clears).
// Dual-writes: legacy camper field + dailyOverrides.
export const setEarlyPickup = mutation({
  args: { id: v.id("campers"), time: v.string(), staffName: v.optional(v.string()) },
  handler: async (ctx, { id, time, staffName = "Admin" }) => {
    const val = time.trim() ? time.trim() : undefined;
    await ctx.db.patch(id, { earlyPickupTime: val });
    const d = today();
    const existing = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", id).eq("date", d))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { earlyPickupTime: val, updatedBy: staffName, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dailyOverrides", { camperId: id, date: d, earlyPickupTime: val, createdBy: staffName, createdAt: Date.now() });
    }
  },
});

// Set one-day arrival or dismissal override. Dual-writes.
export const setDailyOverride = mutation({
  args: {
    id:       v.id("campers"),
    kind:     v.union(v.literal("arrival"), v.literal("dismissal")),
    override: v.optional(v.string()),
    staffName: v.optional(v.string()),
  },
  handler: async (ctx, { id, kind, override, staffName = "Admin" }) => {
    if (kind === "arrival") {
      await ctx.db.patch(id, { dailyArrivalOverride: override });
    } else {
      await ctx.db.patch(id, { dailyDismissalOverride: override });
    }
    const d = today();
    const field = kind === "arrival" ? "morningArrival" : "afternoonDismissal";
    const existing = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", id).eq("date", d))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { [field]: override, updatedBy: staffName, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dailyOverrides", { camperId: id, date: d, [field]: override, createdBy: staffName, createdAt: Date.now() });
    }
  },
});

// Set or clear a counselor-visible attendance note
export const setAttendanceNote = mutation({
  args: { id: v.id("campers"), note: v.string() },
  handler: async (ctx, { id, note }) => {
    await ctx.db.patch(id, { attendanceNote: note.trim() ? note.trim() : undefined });
  },
});

// Mark a camper Present/Absent for a specific period (specialists & period-running counselors)
export const setPeriodAttendance = mutation({
  args: {
    id: v.id("campers"),
    period: v.string(),
    status: v.union(v.literal("Present"), v.literal("Absent")),
    staffName: v.string(),
  },
  handler: async (ctx, { id, period, status, staffName }) => {
    const camper = await ctx.db.get(id);
    if (!camper) return;
    const periodAttendance = { ...(camper.periodAttendance ?? {}), [period]: status };
    await ctx.db.patch(id, { periodAttendance });
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint: period as "Period1" | "Period2" | "Period3" | "Period4" | "Period5" | "Period6",
      status: `${status} for ${period}`,
      staffName,
      timestamp: Date.now(),
    });
  },
});

// Generic per-day checkpoint check-off (Before Care, After Care, Lunch, Bus sheets).
// "in" phase = arrived/checked in; "out" phase = left/departed (only meaningful once "in" is true).
export const setCheckpoint = mutation({
  args: {
    id: v.id("campers"),
    checkpoint: v.union(v.literal("BeforeCare"), v.literal("AfterCare"), v.literal("Lunch"), v.literal("Bus")),
    value: v.boolean(),
    staffName: v.string(),
    label: v.optional(v.string()), // optional human-friendly group name, e.g. "Bus 3"
    phase: v.optional(v.union(v.literal("in"), v.literal("out"))), // defaults to "in"
  },
  handler: async (ctx, { id, checkpoint, value, staffName, label, phase = "in" }) => {
    const camper = await ctx.db.get(id);
    if (!camper) return;

    if (phase === "out") {
      const dailyCheckpointsOut = { ...(camper.dailyCheckpointsOut ?? {}), [checkpoint]: value };
      await ctx.db.patch(id, { dailyCheckpointsOut });
      await ctx.db.insert("attendanceLogs", {
        camperId: id,
        date: today(),
        checkpoint,
        status: value ? `Checked out${label ? ` (${label})` : ""}` : `Undid check out${label ? ` (${label})` : ""}`,
        staffName,
        timestamp: Date.now(),
      });
      return;
    }

    const dailyCheckpoints = { ...(camper.dailyCheckpoints ?? {}), [checkpoint]: value };
    const patch: Record<string, unknown> = { dailyCheckpoints };

    // Turning "in" off also clears "out" — can't be checked out without checking in.
    if (!value && camper.dailyCheckpointsOut?.[checkpoint]) {
      patch.dailyCheckpointsOut = { ...camper.dailyCheckpointsOut, [checkpoint]: false };
    }

    // Auto-handoff cascades (checking INTO a location confirms departure from the prior one):
    // AC In confirmed → also mark bunk as "out" if not already
    if (checkpoint === "AfterCare" && value && !camper.leftEarly) {
      patch.leftEarly   = true;
      patch.tLeftEarly  = Date.now();
    }
    // Bus In confirmed → also mark bunk as "out" if not already
    if (checkpoint === "Bus" && value && !camper.leftEarly) {
      patch.leftEarly   = true;
      patch.tLeftEarly  = Date.now();
    }
    // BC In confirmed → mark as on campus (arrivalStatus Arrived)
    if (checkpoint === "BeforeCare" && value && !camper.arrivalStatus) {
      patch.arrivalStatus = "Arrived";
    }

    await ctx.db.patch(id, patch);
    await ctx.db.insert("attendanceLogs", {
      camperId: id,
      date: today(),
      checkpoint,
      status: value ? `Checked in${label ? ` (${label})` : ""}` : `Unchecked${label ? ` (${label})` : ""}`,
      staffName,
      timestamp: Date.now(),
    });
  },
});
