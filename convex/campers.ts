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

export const resetDay = mutation({
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
        // reset daily attendance fields
        arrivalStatus: undefined,
        arrivalType: undefined,
        bunkConfirmed: undefined,
      });
    }
  },
});

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
    await ctx.db.patch(id, { bunkConfirmed: true, arrivalStatus: "Arrived" });
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
    });
  },
});
