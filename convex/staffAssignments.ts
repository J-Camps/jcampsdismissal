import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ASSIGNMENT_TYPE = v.union(
  v.literal("bunk"),
  v.literal("period"),
  v.literal("lunch"),
  v.literal("dismissal"),
  v.literal("bus"),
  v.literal("beforecare"),
  v.literal("aftercare"),
);

export const listForStaff = query({
  args: { staffId: v.id("staff") },
  handler: async (ctx, { staffId }) => {
    return await ctx.db
      .query("staffAssignments")
      .withIndex("by_staff", (q) => q.eq("staffId", staffId))
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("staffAssignments").collect();
  },
});

export const getByBunk = query({
  args: { bunk: v.string() },
  handler: async (ctx, { bunk }) => {
    return await ctx.db
      .query("staffAssignments")
      .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
      .collect();
  },
});

export const getByPeriodClass = query({
  args: { period: v.string(), className: v.string() },
  handler: async (ctx, { period, className }) => {
    return await ctx.db
      .query("staffAssignments")
      .withIndex("by_period_class", (q) => q.eq("period", period).eq("className", className))
      .collect();
  },
});

export const create = mutation({
  args: {
    staffId: v.id("staff"),
    type: ASSIGNMENT_TYPE,
    camp: v.optional(v.string()),
    division: v.optional(v.string()),
    bunk: v.optional(v.string()),
    period: v.optional(v.string()),
    className: v.optional(v.string()),
    busRoute: v.optional(v.string()),
    dismissalRole: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("staffAssignments", {
      ...args,
      isActive: args.isActive ?? true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("staffAssignments"),
    type: v.optional(ASSIGNMENT_TYPE),
    camp: v.optional(v.string()),
    division: v.optional(v.string()),
    bunk: v.optional(v.string()),
    period: v.optional(v.string()),
    className: v.optional(v.string()),
    busRoute: v.optional(v.string()),
    dismissalRole: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("staffAssignments") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
