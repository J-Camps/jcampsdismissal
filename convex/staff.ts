import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { STAFF_ROLE, PERIOD_ASSIGNMENT } from "./schema";

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("staff")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("staff").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    role: STAFF_ROLE,
    extraRoles: v.optional(v.array(STAFF_ROLE)),
    bunkAssignment: v.optional(v.string()),
    runnerLabel: v.optional(v.string()),
    periodAssignments: v.optional(v.array(PERIOD_ASSIGNMENT)),
    groupAssignment: v.optional(v.string()),
    sectionScope: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (existing) throw new Error(`Code ${args.code} is already in use`);
    return await ctx.db.insert("staff", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("staff"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    role: v.optional(STAFF_ROLE),
    extraRoles: v.optional(v.array(STAFF_ROLE)),
    bunkAssignment: v.optional(v.string()),
    runnerLabel: v.optional(v.string()),
    periodAssignments: v.optional(v.array(PERIOD_ASSIGNMENT)),
    groupAssignment: v.optional(v.string()),
    sectionScope: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...fields }) => {
    if (fields.code) {
      const existing = await ctx.db
        .query("staff")
        .withIndex("by_code", (q) => q.eq("code", fields.code!))
        .first();
      if (existing && existing._id !== id) {
        throw new Error(`Code ${fields.code} is already in use`);
      }
    }
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("staff") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
