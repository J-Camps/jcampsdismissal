import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

export const getForCamper = query({
  args: { camperId: v.id("campers") },
  handler: async (ctx, { camperId }) => {
    return await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
  },
});

export const getActiveForCamper = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    const all = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
    return all.filter((r) => {
      if (r.isActive === false) return false;
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
    session: v.optional(v.string()),
    effectiveStartDate: v.optional(v.string()),
    effectiveEndDate: v.optional(v.string()),
    source: v.optional(v.union(v.literal("upload"), v.literal("manual"))),
    uploadBatchId: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_camper", (q) => q.eq("camperId", args.camperId))
      .collect();
    const active = existing.filter(
      (r) => r.period === args.period && r.isActive !== false &&
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
