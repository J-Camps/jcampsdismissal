import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Track definitions ───────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("tracks").collect(),
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tracks").collect();
    return all.filter((t) => t.isActive !== false);
  },
});

// Tracks a given staff member is assigned to lead.
export const getForStaff = query({
  args: { staffId: v.string() },
  handler: async (ctx, { staffId }) => {
    const all = await ctx.db.query("tracks").collect();
    return all.filter((t) => t.isActive !== false && (t.assignedStaffIds ?? []).includes(staffId));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    location: v.optional(v.string()),
    assignedStaffIds: v.optional(v.array(v.string())),
    sortOrder: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) throw new Error(`Track "${args.name}" already exists`);
    return await ctx.db.insert("tracks", {
      ...args,
      normalizedName: args.name.toLowerCase().trim(),
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tracks"),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, unknown> = { ...fields, updatedAt: Date.now() };
    if (fields.name) patch.normalizedName = fields.name.toLowerCase().trim();
    await ctx.db.patch(id, patch);
  },
});

export const assignStaff = mutation({
  args: { id: v.id("tracks"), staffIds: v.array(v.string()) },
  handler: async (ctx, { id, staffIds }) => {
    await ctx.db.patch(id, { assignedStaffIds: staffIds, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("tracks") },
  handler: async (ctx, { id }) => {
    const track = await ctx.db.get(id);
    if (!track) return;
    // Unassign any campers currently in this track.
    const campers = await ctx.db
      .query("campers")
      .withIndex("by_track", (q) => q.eq("track", track.name))
      .collect();
    for (const c of campers) await ctx.db.patch(c._id, { track: undefined });
    await ctx.db.delete(id);
  },
});

export const getOrCreate = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("tracks", {
      name,
      normalizedName: name.toLowerCase().trim(),
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

// ── Camper ↔ track assignment ───────────────────────────────────────────────

export const getRoster = query({
  args: { track: v.string() },
  handler: async (ctx, { track }) => {
    const campers = await ctx.db
      .query("campers")
      .withIndex("by_track", (q) => q.eq("track", track))
      .collect();
    return campers.filter((c) => c.isActive !== false);
  },
});

export const setCamperTrack = mutation({
  args: { camperId: v.id("campers"), track: v.optional(v.string()) },
  handler: async (ctx, { camperId, track }) => {
    await ctx.db.patch(camperId, { track: track || undefined });
  },
});

export const clearAllCamperTracks = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("campers").collect();
    let cleared = 0;
    for (const c of all) {
      if (c.track) { await ctx.db.patch(c._id, { track: undefined }); cleared++; }
    }
    return cleared;
  },
});
