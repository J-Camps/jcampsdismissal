import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

export const getForDate = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const d = date ?? today();
    return await ctx.db
      .query("trackAttendanceRecords")
      .withIndex("by_date", (q) => q.eq("date", d))
      .collect();
  },
});

export const getForTrackDate = query({
  args: { track: v.string(), date: v.optional(v.string()) },
  handler: async (ctx, { track, date }) => {
    const d = date ?? today();
    return await ctx.db
      .query("trackAttendanceRecords")
      .withIndex("by_track_date", (q) => q.eq("track", track).eq("date", d))
      .collect();
  },
});

export const getForCamperDate = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    return await ctx.db
      .query("trackAttendanceRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .first();
  },
});

// Mark a camper Present/Absent in their track for the day (upsert).
export const mark = mutation({
  args: {
    camperId: v.id("campers"),
    track: v.string(),
    status: v.union(v.literal("Present"), v.literal("Absent")),
    staffId: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { camperId, track, status, staffId, date }) => {
    const d = date ?? today();
    const existing = await ctx.db
      .query("trackAttendanceRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { track, status, markedAt: Date.now(), markedByStaffId: staffId });
      return existing._id;
    }
    return await ctx.db.insert("trackAttendanceRecords", {
      camperId,
      date: d,
      track,
      status,
      markedAt: Date.now(),
      markedByStaffId: staffId,
    });
  },
});

// Clear a camper's track mark for the day (back to unmarked).
export const clearMark = mutation({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    const existing = await ctx.db
      .query("trackAttendanceRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
