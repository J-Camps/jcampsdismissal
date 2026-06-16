import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

// ─── Queries ──────────────────────────────────────────────────────────────────

// All overrides for a given date (default: today). Used by admin override screen.
export const getForDate = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const d = date ?? today();
    return ctx.db
      .query("dailyOverrides")
      .withIndex("by_date", q => q.eq("date", d))
      .collect();
  },
});

// A single camper's override for a given date (default: today).
export const getForCamper = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    return ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .first();
  },
});

// All overrides on or after a given date — for admin "upcoming changes" view.
export const getUpcoming = query({
  args: { fromDate: v.optional(v.string()) },
  handler: async (ctx, { fromDate }) => {
    const from = fromDate ?? today();
    const all = await ctx.db.query("dailyOverrides").collect();
    return all.filter(o => o.date >= from);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

// Create or update an override for a camper on a specific date.
// Only the fields explicitly provided are written; others remain unchanged.
export const upsert = mutation({
  args: {
    camperId:           v.id("campers"),
    date:               v.optional(v.string()),
    morningArrival:     v.optional(v.string()),
    afternoonDismissal: v.optional(v.string()),
    lateDropoffTime:    v.optional(v.string()),
    earlyPickupTime:    v.optional(v.string()),
    isAbsent:           v.optional(v.boolean()),
    note:               v.optional(v.string()),
    staffName:          v.string(),
  },
  handler: async (ctx, { camperId, date, staffName, ...fields }) => {
    const d = date ?? today();
    const existing = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        updatedBy: staffName,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dailyOverrides", {
        camperId,
        date: d,
        ...fields,
        createdBy: staffName,
        createdAt: Date.now(),
      });
    }
  },
});

// Clear one specific field on a camper's override for a date.
// Useful when un-setting a late drop-off or early pickup that was entered by mistake.
export const clearField = mutation({
  args: {
    camperId: v.id("campers"),
    date:     v.optional(v.string()),
    field:    v.union(
      v.literal("morningArrival"),
      v.literal("afternoonDismissal"),
      v.literal("lateDropoffTime"),
      v.literal("earlyPickupTime"),
      v.literal("isAbsent"),
      v.literal("note"),
    ),
    staffName: v.string(),
  },
  handler: async (ctx, { camperId, date, field, staffName }) => {
    const d = date ?? today();
    const existing = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .first();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      [field]: undefined,
      updatedBy: staffName,
      updatedAt: Date.now(),
    });
  },
});

// Delete the entire override row for a camper on a given date.
export const remove = mutation({
  args: {
    camperId: v.id("campers"),
    date:     v.optional(v.string()),
  },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    const rows = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
