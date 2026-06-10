import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ATTENDANCE_STATUS } from "./schema";

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
