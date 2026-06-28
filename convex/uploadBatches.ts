import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, { type }) => {
    if (type) {
      return await ctx.db
        .query("uploadBatches")
        .withIndex("by_type", (q) => q.eq("type", type as "period"))
        .collect();
    }
    return await ctx.db.query("uploadBatches").collect();
  },
});

export const create = mutation({
  args: {
    type: v.union(v.literal("period"), v.literal("lunch"), v.literal("camper"), v.literal("staff")),
    uploadedByStaffId: v.optional(v.string()),
    session: v.optional(v.string()),
    mode: v.optional(v.string()),
    filename: v.optional(v.string()),
    rowsImported: v.optional(v.number()),
    rowsSkipped: v.optional(v.number()),
    warnings: v.optional(v.number()),
    errors: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("uploadBatches", {
      ...args,
      uploadedAt: Date.now(),
      canUndo: true,
    });
  },
});

export const markUndone = mutation({
  args: { id: v.id("uploadBatches") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { canUndo: false, undoneAt: Date.now() });
  },
});
