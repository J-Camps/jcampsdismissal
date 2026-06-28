import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { dayTypeForDate, normDayType } from "./periodDays";

const today = () => new Date().toISOString().split("T")[0];

const DAY_TYPE = v.union(v.literal("MonThu"), v.literal("Friday"));

export const getForCamper = query({
  args: { camperId: v.id("campers"), dayType: v.optional(DAY_TYPE) },
  handler: async (ctx, { camperId, dayType }) => {
    const all = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
    return dayType === undefined
      ? all
      : all.filter((r) => normDayType(r.dayType) === dayType);
  },
});

export const getActiveForCamper = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()), dayType: v.optional(DAY_TYPE) },
  handler: async (ctx, { camperId, date, dayType }) => {
    const d = date ?? today();
    // Schedule applies based on the day-of-week being viewed unless overridden.
    const dt = dayType ?? dayTypeForDate(d);
    const all = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
    return all.filter((r) => {
      if (r.isActive === false) return false;
      if (normDayType(r.dayType) !== dt) return false;
      if (r.effectiveStartDate && r.effectiveStartDate > d) return false;
      if (r.effectiveEndDate && r.effectiveEndDate < d) return false;
      return true;
    });
  },
});

export const getForClass = query({
  args: { periodClassId: v.id("periodClasses"), date: v.optional(v.string()) },
  handler: async (ctx, { periodClassId, date }) => {
    const d = date ?? today();
    const all = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_class", (q) => q.eq("periodClassId", periodClassId))
      .collect();
    return all.filter((r) => {
      if (r.isActive === false) return false;
      if (r.effectiveStartDate && r.effectiveStartDate > d) return false;
      if (r.effectiveEndDate && r.effectiveEndDate < d) return false;
      return true;
    });
  },
});

export const assign = mutation({
  args: {
    camperId: v.id("campers"),
    period: v.string(),
    periodClassId: v.id("periodClasses"),
    classNameSnapshot: v.string(),
    dayType: v.optional(DAY_TYPE),
    session: v.optional(v.string()),
    effectiveStartDate: v.optional(v.string()),
    effectiveEndDate: v.optional(v.string()),
    source: v.optional(v.union(v.literal("upload"), v.literal("manual"))),
    uploadBatchId: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // dayType follows the class being assigned (falls back to an explicit arg, then Mon–Thu).
    const cls = await ctx.db.get(args.periodClassId);
    const dayType = normDayType(cls?.dayType ?? args.dayType);

    const existing = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", args.camperId))
      .collect();
    // Only supersede prior assignments for the SAME period AND the same dayType.
    const active = existing.filter(
      (r) => r.period === args.period && normDayType(r.dayType) === dayType && r.isActive !== false &&
        (!r.effectiveEndDate || r.effectiveEndDate >= (args.effectiveStartDate ?? today()))
    );
    for (const old of active) {
      await ctx.db.patch(old._id, {
        effectiveEndDate: args.effectiveStartDate ?? today(),
        isActive: false,
        updatedAt: Date.now(),
        updatedByStaffId: args.staffId,
      });
    }
    return await ctx.db.insert("periodScheduleRecords", {
      camperId: args.camperId,
      period: args.period,
      periodClassId: args.periodClassId,
      classNameSnapshot: args.classNameSnapshot,
      dayType,
      session: args.session,
      effectiveStartDate: args.effectiveStartDate ?? today(),
      effectiveEndDate: args.effectiveEndDate,
      isActive: true,
      source: args.source ?? "manual",
      uploadBatchId: args.uploadBatchId,
      createdAt: Date.now(),
      createdByStaffId: args.staffId,
    });
  },
});

export const endAssignment = mutation({
  args: {
    id: v.id("periodScheduleRecords"),
    endDate: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, { id, endDate, staffId }) => {
    await ctx.db.patch(id, {
      effectiveEndDate: endDate ?? today(),
      isActive: false,
      updatedAt: Date.now(),
      updatedByStaffId: staffId,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("periodScheduleRecords") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const clearForCamper = mutation({
  args: { camperId: v.id("campers") },
  handler: async (ctx, { camperId }) => {
    const all = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
    for (const r of all) await ctx.db.delete(r._id);
    return all.length;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("periodScheduleRecords").collect();
    for (const r of all) await ctx.db.delete(r._id);
    return all.length;
  },
});
