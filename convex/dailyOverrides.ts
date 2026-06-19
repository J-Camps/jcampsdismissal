import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

// ─── Queries ──────────────────────────────────────────────────────────────────

// All active overrides for a given date (default: today).
export const getForDate = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const d = date ?? today();
    const all = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_date", q => q.eq("date", d))
      .collect();
    return all.filter(o => o.status !== "cleared");
  },
});

// A single camper's active override for a given date (default: today).
export const getForCamper = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? today();
    const row = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .first();
    if (row?.status === "cleared") return null;
    return row;
  },
});

// All active overrides on or after a given date — for admin "Upcoming Changes" view.
export const getUpcoming = query({
  args: { fromDate: v.optional(v.string()) },
  handler: async (ctx, { fromDate }) => {
    const from = fromDate ?? today();
    const all = await ctx.db.query("dailyOverrides").collect();
    return all.filter(o => o.date >= from && o.status !== "cleared");
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

// Create or update an override for a camper on a specific date.
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
        status: "active",
        updatedBy: staffName,
        updatedAt: Date.now(),
        clearedAt: undefined,
        clearedBy: undefined,
      });
    } else {
      await ctx.db.insert("dailyOverrides", {
        camperId,
        date: d,
        ...fields,
        status: "active",
        createdBy: staffName,
        createdAt: Date.now(),
      });
    }
  },
});

// Clear one specific field on a camper's override for a date.
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

// Clear a single camper's override for a date (soft delete).
export const clearOne = mutation({
  args: {
    camperId:  v.id("campers"),
    date:      v.optional(v.string()),
    staffName: v.string(),
  },
  handler: async (ctx, { camperId, date, staffName }) => {
    const d = date ?? today();
    const rows = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .collect();
    for (const r of rows) {
      await ctx.db.patch(r._id, {
        status: "cleared",
        clearedAt: Date.now(),
        clearedBy: staffName,
      });
    }
  },
});

// Clear ALL overrides for a specific date only (soft delete).
// Never touches future dates.
export const clearForDate = mutation({
  args: {
    date:      v.optional(v.string()),
    staffName: v.string(),
  },
  handler: async (ctx, { date, staffName }) => {
    const d = date ?? today();
    const rows = await ctx.db
      .query("dailyOverrides")
      .withIndex("by_date", q => q.eq("date", d))
      .collect();
    for (const r of rows) {
      if (r.status !== "cleared") {
        await ctx.db.patch(r._id, {
          status: "cleared",
          clearedAt: Date.now(),
          clearedBy: staffName,
        });
      }
    }
  },
});

// Hard delete — kept for backward compat but prefer clearOne/clearForDate.
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
