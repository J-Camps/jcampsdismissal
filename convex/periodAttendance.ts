import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

export const getForCamperDate = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    return await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .collect();
  },
});

export const getForClassDate = query({
  args: { period: v.string(), className: v.string(), date: v.optional(v.string()) },
  handler: async (ctx, { period, className, date }) => {
    const d = date ?? today();
    return await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_period_class_date", (q) =>
        q.eq("period", period).eq("className", className).eq("date", d)
      )
      .collect();
  },
});

export const checkIn = mutation({
  args: {
    camperId: v.id("campers"),
    period: v.string(),
    className: v.string(),
    staffId: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { camperId, period, className, staffId, date }) => {
    const d = date ?? today();
    const existing = await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .collect();
    const match = existing.find((r) => r.period === period && r.className === className);

    if (match) {
      await ctx.db.patch(match._id, {
        checkedIn: true,
        checkedInAt: Date.now(),
        checkedInByStaffId: staffId,
      });
      return match._id;
    }

    return await ctx.db.insert("periodAttendanceRecords", {
      camperId,
      date: d,
      period,
      className,
      checkedIn: true,
      checkedInAt: Date.now(),
      checkedInByStaffId: staffId,
    });
  },
});

export const undoCheckIn = mutation({
  args: { id: v.id("periodAttendanceRecords") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      checkedIn: false,
      checkedInAt: undefined,
      checkedInByStaffId: undefined,
    });
  },
});
