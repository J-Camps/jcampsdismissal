import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { dayTypeForDate } from "./periodDays";

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

export const getForPeriodClassDate = query({
  args: { periodClassId: v.id("periodClasses"), date: v.optional(v.string()) },
  handler: async (ctx, { periodClassId, date }) => {
    const d = date ?? today();
    return await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_class_date", (q) => q.eq("periodClassId", periodClassId).eq("date", d))
      .collect();
  },
});

export const checkIn = mutation({
  args: {
    camperId: v.id("campers"),
    period: v.string(),
    className: v.string(),
    periodClassId: v.optional(v.id("periodClasses")),
    staffId: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { camperId, period, className, periodClassId, staffId, date }) => {
    const d = date ?? today();
    const existing = await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .collect();
    const match = existing.find((r) => r.period === period);

    if (match) {
      await ctx.db.patch(match._id, {
        checkedIn: true,
        checkedInAt: Date.now(),
        checkedInByStaffId: staffId,
        classNameSnapshot: className,
        periodClassId,
        dayType: dayTypeForDate(d),
        updatedAt: Date.now(),
      });
      return match._id;
    }

    return await ctx.db.insert("periodAttendanceRecords", {
      camperId,
      date: d,
      period,
      className,
      classNameSnapshot: className,
      periodClassId,
      dayType: dayTypeForDate(d),
      checkedIn: true,
      checkedInAt: Date.now(),
      checkedInByStaffId: staffId,
    });
  },
});

export const undoCheckIn = mutation({
  args: { id: v.id("periodAttendanceRecords"), staffId: v.optional(v.string()), reason: v.optional(v.string()) },
  handler: async (ctx, { id, staffId, reason }) => {
    await ctx.db.patch(id, {
      checkedIn: false,
      checkedInAt: undefined,
      checkedInByStaffId: undefined,
      overrideReason: reason,
      updatedAt: Date.now(),
    });
  },
});

export const hasHistoryForClass = query({
  args: { periodClassId: v.id("periodClasses") },
  handler: async (ctx, { periodClassId }) => {
    const rec = await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_class_date", (q) => q.eq("periodClassId", periodClassId))
      .first();
    return !!rec;
  },
});
