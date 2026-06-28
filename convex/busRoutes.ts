import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("busRoutes").collect();
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("busRoutes").collect();
    return all.filter((r) => r.isActive !== false);
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("busRoutes")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    routeNumber: v.optional(v.number()),
    color: v.optional(v.string()),
    colorHex: v.optional(v.string()),
    colorLight: v.optional(v.string()),
    colorBorder: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("busRoutes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) throw new Error(`Bus route "${args.name}" already exists`);
    return await ctx.db.insert("busRoutes", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("busRoutes"),
    name: v.optional(v.string()),
    routeNumber: v.optional(v.number()),
    color: v.optional(v.string()),
    colorHex: v.optional(v.string()),
    colorLight: v.optional(v.string()),
    colorBorder: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    if (fields.name) {
      const existing = await ctx.db
        .query("busRoutes")
        .withIndex("by_name", (q) => q.eq("name", fields.name!))
        .first();
      if (existing && existing._id !== id) throw new Error(`Bus route "${fields.name}" already exists`);
    }
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("busRoutes") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const seedFromCamperData = mutation({
  args: {},
  handler: async (ctx) => {
    const campers = await ctx.db.query("campers").collect();
    const routes = new Set<string>();
    for (const c of campers) {
      if (c.arrivalMethod?.toLowerCase().includes("bus")) routes.add(c.arrivalMethod);
      if (c.dismissalMethod?.toLowerCase().includes("bus")) routes.add(c.dismissalMethod);
    }

    const colors: Record<string, { hex: string; light: string; border: string }> = {
      "Blue Bus":   { hex: "#2563eb", light: "#dbeafe", border: "#93c5fd" },
      "Red Bus":    { hex: "#dc2626", light: "#fee2e2", border: "#fca5a5" },
      "Green Bus":  { hex: "#16a34a", light: "#dcfce7", border: "#86efac" },
      "Yellow Bus": { hex: "#ca8a04", light: "#fef9c3", border: "#fde047" },
      "Orange Bus": { hex: "#ea580c", light: "#ffedd5", border: "#fdba74" },
      "Purple Bus": { hex: "#7c3aed", light: "#ede9fe", border: "#c4b5fd" },
    };

    let created = 0;
    let i = 1;
    for (const name of [...routes].sort()) {
      const existing = await ctx.db
        .query("busRoutes")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (existing) { i++; continue; }
      const c = colors[name];
      await ctx.db.insert("busRoutes", {
        name,
        routeNumber: i,
        color: name.replace(" Bus", ""),
        colorHex: c?.hex ?? "#023B64",
        colorLight: c?.light ?? "#e0f2fe",
        colorBorder: c?.border ?? "#93c5fd",
        isActive: true,
        sortOrder: i,
        createdAt: Date.now(),
      });
      created++;
      i++;
    }
    return { created, total: routes.size };
  },
});
