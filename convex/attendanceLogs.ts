import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const logs = await ctx.db
      .query("attendanceLogs")
      .withIndex("by_date", (q) => q.eq("date", date))
      .order("asc")
      .collect();
    const withCampers = await Promise.all(
      logs.map(async (log) => {
        const camper = await ctx.db.get(log.camperId);
        return { ...log, camperName: camper?.preferredName ?? camper?.name ?? "Unknown" };
      })
    );
    return withCampers;
  },
});

export const getByCamper = query({
  args: { camperId: v.id("campers"), date: v.string() },
  handler: async (ctx, { camperId, date }) => {
    return await ctx.db
      .query("attendanceLogs")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", date))
      .order("asc")
      .collect();
  },
});
