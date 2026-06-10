import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ATTENDANCE_STATUS, LUNCH_TYPE, DISMISSAL_ROUTE, MORNING_STAGE } from "./schema";

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

export const searchByName = query({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await ctx.db.query("campers").collect();
    return all
      .filter((c) => c.name.toLowerCase().includes(q) || c.bunk.toLowerCase().includes(q))
      .slice(0, 10);
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
      }
    }
  },
});

export const callByIds = mutation({
  args: { ids: v.array(v.id("campers")), source: v.union(v.literal("Carline"), v.literal("Walk-Up")) },
  handler: async (ctx, { ids, source }) => {
    for (const id of ids) {
      const c = await ctx.db.get(id);
      if (c && c.status === "Waiting") {
        await ctx.db.patch(id, { status: "Called", callSource: source, tCalled: Date.now() });
      }
    }
  },
});

export const assign = mutation({
  args: { id: v.id("campers"), runner: v.string() },
  handler: async (ctx, { id, runner }) => {
    await ctx.db.patch(id, { status: "Assigned", runner, tAssigned: Date.now() });
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
        status: "Waiting", callSource: undefined, runner: undefined, note: undefined,
        tCalled: undefined, tAssigned: undefined, tPickedUp: undefined, tDismissed: undefined,
        attendanceStatus: undefined,
        morningStage: c.morningRoute ? "NotArrived" : undefined,
        tMorningStage: undefined,
        sentToBus: undefined, sentToAfterCare: undefined, afterCareConfirmed: undefined,
        earlyDismissal: undefined,
      });
    }
  },
});

export const setAttendanceStatus = mutation({
  args: { id: v.id("campers"), attendanceStatus: ATTENDANCE_STATUS },
  handler: async (ctx, { id, attendanceStatus }) => {
    await ctx.db.patch(id, { attendanceStatus });
  },
});

// ---------------------------------------------------------------------
// Attendance + dismissal redesign: bunks, presence, morning/afternoon flow
// ---------------------------------------------------------------------

export const getBunks = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    return Array.from(new Set(all.map((c) => c.bunk))).sort();
  },
});

export const byBunk = query({
  args: { bunk: v.string() },
  handler: async (ctx, { bunk }) => {
    return await ctx.db
      .query("campers")
      .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
      .collect();
  },
});

export const busOverview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    const buses: Record<string, typeof all> = {};
    for (const c of all) {
      if (c.morningRoute === "Bus" && c.busRoute) {
        (buses[c.busRoute] ??= []).push(c);
      }
    }
    return buses;
  },
});

export const setLunchType = mutation({
  args: { id: v.id("campers"), lunchType: LUNCH_TYPE },
  handler: async (ctx, { id, lunchType }) => {
    await ctx.db.patch(id, { lunchType });
  },
});

export const setDismissalRoute = mutation({
  args: { id: v.id("campers"), dismissalRoute: v.optional(DISMISSAL_ROUTE) },
  handler: async (ctx, { id, dismissalRoute }) => {
    await ctx.db.patch(id, { dismissalRoute });
  },
});

export const setDismissalRouteOverride = mutation({
  args: { id: v.id("campers"), dismissalRouteOverride: v.optional(DISMISSAL_ROUTE) },
  handler: async (ctx, { id, dismissalRouteOverride }) => {
    await ctx.db.patch(id, { dismissalRouteOverride });
  },
});

export const setMorningRoute = mutation({
  args: {
    id: v.id("campers"),
    morningRoute: v.optional(v.union(
      v.literal("Bus"), v.literal("Carline"), v.literal("WalkUp"), v.literal("BeforeCare"),
    )),
    busRoute: v.optional(v.string()),
  },
  handler: async (ctx, { id, morningRoute, busRoute }) => {
    await ctx.db.patch(id, { morningRoute, busRoute, morningStage: morningRoute ? "NotArrived" : undefined });
  },
});

export const setMorningStage = mutation({
  args: { id: v.id("campers"), stage: MORNING_STAGE },
  handler: async (ctx, { id, stage }) => {
    await ctx.db.patch(id, { morningStage: stage, tMorningStage: Date.now() });
  },
});

export const toggleAbsent = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    const c = await ctx.db.get(id);
    if (!c) return;
    const isAbsent = c.attendanceStatus === "Absent";
    await ctx.db.patch(id, { attendanceStatus: isAbsent ? "Present" : "Absent" });
  },
});

export const setEarlyDismissal = mutation({
  args: { id: v.id("campers"), earlyDismissal: v.boolean() },
  handler: async (ctx, { id, earlyDismissal }) => {
    await ctx.db.patch(id, { earlyDismissal });
  },
});

export const sendToBus = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { sentToBus: true });
  },
});

export const sendToAfterCare = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { sentToAfterCare: true });
  },
});

export const confirmAfterCare = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { afterCareConfirmed: true });
  },
});

export const undoAfternoon = mutation({
  args: { id: v.id("campers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { sentToBus: undefined, sentToAfterCare: undefined, afterCareConfirmed: undefined });
  },
});
