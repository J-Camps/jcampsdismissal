import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("campStructure").collect();
  },
});

export const getByCamp = query({
  args: { camp: v.string() },
  handler: async (ctx, { camp }) => {
    return await ctx.db
      .query("campStructure")
      .withIndex("by_camp", (q) => q.eq("camp", camp))
      .collect();
  },
});

export const getByBunk = query({
  args: { bunk: v.string() },
  handler: async (ctx, { bunk }) => {
    return await ctx.db
      .query("campStructure")
      .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
      .first();
  },
});

export const getActiveBunks = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campStructure").collect();
    return all.filter((s) => s.isActive !== false);
  },
});

export const getCamps = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campStructure").collect();
    return [...new Set(all.filter((s) => s.isActive !== false).map((s) => s.camp))].sort();
  },
});

export const getDivisions = query({
  args: { camp: v.string() },
  handler: async (ctx, { camp }) => {
    const rows = await ctx.db
      .query("campStructure")
      .withIndex("by_camp", (q) => q.eq("camp", camp))
      .collect();
    return [...new Set(rows.filter((s) => s.isActive !== false).map((s) => s.division))].sort();
  },
});

export const create = mutation({
  args: {
    camp: v.string(),
    division: v.string(),
    bunk: v.string(),
    displayName: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    defaultLocation: v.optional(v.string()),
    dismissalLocation: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("campStructure")
      .withIndex("by_bunk", (q) => q.eq("bunk", args.bunk))
      .first();
    if (existing) throw new Error(`Bunk "${args.bunk}" already exists`);
    return await ctx.db.insert("campStructure", {
      ...args,
      isActive: args.isActive ?? true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("campStructure"),
    camp: v.optional(v.string()),
    division: v.optional(v.string()),
    bunk: v.optional(v.string()),
    displayName: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    defaultLocation: v.optional(v.string()),
    dismissalLocation: v.optional(v.string()),
    assignedStaff: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...fields }) => {
    if (fields.bunk) {
      const existing = await ctx.db
        .query("campStructure")
        .withIndex("by_bunk", (q) => q.eq("bunk", fields.bunk!))
        .first();
      if (existing && existing._id !== id) {
        throw new Error(`Bunk "${fields.bunk}" already exists`);
      }
    }
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("campStructure") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const bulkCreate = mutation({
  args: {
    entries: v.array(
      v.object({
        camp: v.string(),
        division: v.string(),
        bunk: v.string(),
        displayName: v.optional(v.string()),
        sortOrder: v.optional(v.number()),
        isActive: v.optional(v.boolean()),
        defaultLocation: v.optional(v.string()),
        dismissalLocation: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { entries }) => {
    let created = 0;
    let skipped = 0;
    for (const entry of entries) {
      const existing = await ctx.db
        .query("campStructure")
        .withIndex("by_bunk", (q) => q.eq("bunk", entry.bunk))
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("campStructure", { ...entry, isActive: entry.isActive ?? true });
      created++;
    }
    return { created, skipped };
  },
});
