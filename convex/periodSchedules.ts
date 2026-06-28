import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("periodSchedules").collect();
  },
});

export const getForCamper = query({
  args: { camperId: v.id("campers") },
  handler: async (ctx, { camperId }) => {
    return await ctx.db
      .query("periodSchedules")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
  },
});

export const getRoster = query({
  args: { period: v.string(), className: v.string() },
  handler: async (ctx, { period, className }) => {
    return await ctx.db
      .query("periodSchedules")
      .withIndex("by_period_class", (q) => q.eq("period", period).eq("className", className))
      .collect();
  },
});

export const getClasses = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("periodSchedules").collect();
    const seen = new Set<string>();
    const classes: { period: string; className: string }[] = [];
    for (const s of all) {
      const key = `${s.period}::${s.className}`;
      if (!seen.has(key)) {
        seen.add(key);
        classes.push({ period: s.period, className: s.className });
      }
    }
    return classes.sort((a, b) => a.period.localeCompare(b.period) || a.className.localeCompare(b.className));
  },
});

export const assign = mutation({
  args: {
    camperId: v.id("campers"),
    period: v.string(),
    className: v.string(),
    room: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("periodSchedules")
      .withIndex("by_camper", (q) => q.eq("camperId", args.camperId))
      .collect();
    const dup = existing.find(e => e.period === args.period);
    if (dup) {
      await ctx.db.patch(dup._id, { className: args.className, room: args.room });
      return dup._id;
    }
    return await ctx.db.insert("periodSchedules", args);
  },
});

export const remove = mutation({
  args: { id: v.id("periodSchedules") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const bulkAssign = mutation({
  args: {
    assignments: v.array(v.object({
      camperId: v.id("campers"),
      period: v.string(),
      className: v.string(),
      room: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { assignments }) => {
    let created = 0;
    let updated = 0;
    for (const a of assignments) {
      const existing = await ctx.db
        .query("periodSchedules")
        .withIndex("by_camper", (q) => q.eq("camperId", a.camperId))
        .collect();
      const dup = existing.find(e => e.period === a.period);
      if (dup) {
        await ctx.db.patch(dup._id, { className: a.className, room: a.room });
        updated++;
      } else {
        await ctx.db.insert("periodSchedules", a);
        created++;
      }
    }
    return { created, updated };
  },
});

export const clearForCamper = mutation({
  args: { camperId: v.id("campers") },
  handler: async (ctx, { camperId }) => {
    const all = await ctx.db
      .query("periodSchedules")
      .withIndex("by_camper", (q) => q.eq("camperId", camperId))
      .collect();
    for (const s of all) await ctx.db.delete(s._id);
    return all.length;
  },
});
