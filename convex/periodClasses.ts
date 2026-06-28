import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("periodClasses").collect();
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("periodClasses").collect();
    return all.filter((c) => c.isActive !== false && c.isArchived !== true);
  },
});

export const getByPeriod = query({
  args: { period: v.string() },
  handler: async (ctx, { period }) => {
    return await ctx.db
      .query("periodClasses")
      .withIndex("by_period", (q) => q.eq("period", period))
      .collect();
  },
});

export const getByPeriodClass = query({
  args: { period: v.string(), className: v.string() },
  handler: async (ctx, { period, className }) => {
    return await ctx.db
      .query("periodClasses")
      .withIndex("by_period_class", (q) => q.eq("period", period).eq("className", className))
      .first();
  },
});

export const create = mutation({
  args: {
    period: v.string(),
    className: v.string(),
    session: v.optional(v.string()),
    location: v.optional(v.string()),
    assignedStaffIds: v.optional(v.array(v.string())),
    sortOrder: v.optional(v.number()),
    capacity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("periodClasses")
      .withIndex("by_period_class", (q) => q.eq("period", args.period).eq("className", args.className))
      .first();
    if (existing) throw new Error(`${args.period} ${args.className} already exists`);
    return await ctx.db.insert("periodClasses", {
      ...args,
      normalizedClassName: args.className.toLowerCase().trim(),
      isActive: true,
      isArchived: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("periodClasses"),
    className: v.optional(v.string()),
    location: v.optional(v.string()),
    assignedStaffIds: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    capacity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, unknown> = { ...fields, updatedAt: Date.now() };
    if (fields.className) patch.normalizedClassName = fields.className.toLowerCase().trim();
    await ctx.db.patch(id, patch);
  },
});

export const archive = mutation({
  args: { id: v.id("periodClasses") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { isArchived: true, isActive: false, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("periodClasses") },
  handler: async (ctx, { id }) => {
    const attendance = await ctx.db
      .query("periodAttendanceRecords")
      .withIndex("by_class_date", (q) => q.eq("periodClassId", id))
      .first();
    if (attendance) throw new Error("Cannot delete a class with attendance history. Archive it instead.");
    const schedules = await ctx.db
      .query("periodScheduleRecords")
      .withIndex("by_class", (q) => q.eq("periodClassId", id))
      .collect();
    for (const s of schedules) await ctx.db.delete(s._id);
    await ctx.db.delete(id);
  },
});

export const assignStaff = mutation({
  args: { id: v.id("periodClasses"), staffIds: v.array(v.string()) },
  handler: async (ctx, { id, staffIds }) => {
    await ctx.db.patch(id, { assignedStaffIds: staffIds, updatedAt: Date.now() });
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const classes = await ctx.db.query("periodClasses").collect();
    const schedules = await ctx.db.query("periodScheduleRecords").collect();
    const attendance = await ctx.db.query("periodAttendanceRecords").collect();
    for (const r of attendance) await ctx.db.delete(r._id);
    for (const r of schedules) await ctx.db.delete(r._id);
    for (const r of classes) await ctx.db.delete(r._id);
    return { classes: classes.length, schedules: schedules.length, attendance: attendance.length };
  },
});

export const getOrCreate = mutation({
  args: { period: v.string(), className: v.string(), session: v.optional(v.string()) },
  handler: async (ctx, { period, className, session }) => {
    const existing = await ctx.db
      .query("periodClasses")
      .withIndex("by_period_class", (q) => q.eq("period", period).eq("className", className))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("periodClasses", {
      period,
      className,
      session,
      normalizedClassName: className.toLowerCase().trim(),
      isActive: true,
      isArchived: false,
      createdAt: Date.now(),
    });
  },
});
