import { query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

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

// ── Paginated history feed ────────────────────────────────────────────────────
// Powers the History tab. Newest-first, streams through the whole table in pages
// so admins can read thousands of records without loading them all at once.
// Optional `date` narrows to one day (uses the by_date index); optional
// `camperId` narrows to a single camper across all days. Each page is enriched
// with camper name / bunk so the UI stays readable.
export const listPaged = query({
  args: {
    paginationOpts: paginationOptsValidator,
    date: v.optional(v.string()),
    camperId: v.optional(v.id("campers")),
  },
  handler: async (ctx, { paginationOpts, date, camperId }) => {
    let page;
    if (camperId && date) {
      page = await ctx.db
        .query("attendanceLogs")
        .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", date))
        .order("desc")
        .paginate(paginationOpts);
    } else if (camperId) {
      page = await ctx.db
        .query("attendanceLogs")
        .withIndex("by_camper_date", (q) => q.eq("camperId", camperId))
        .order("desc")
        .paginate(paginationOpts);
    } else if (date) {
      page = await ctx.db
        .query("attendanceLogs")
        .withIndex("by_date", (q) => q.eq("date", date))
        .order("desc")
        .paginate(paginationOpts);
    } else {
      page = await ctx.db
        .query("attendanceLogs")
        .order("desc")
        .paginate(paginationOpts);
    }

    // Enrich each row with camper identity. Cache camper lookups within the page
    // so repeated campers don't trigger duplicate reads.
    const cache = new Map<string, { name: string; bunk: string }>();
    const enriched = await Promise.all(
      page.page.map(async (log) => {
        let info = cache.get(log.camperId);
        if (!info) {
          const camper = await ctx.db.get(log.camperId);
          info = {
            name: camper?.preferredName ?? camper?.name ?? "Unknown",
            bunk: camper?.bunk ?? "",
          };
          cache.set(log.camperId, info);
        }
        return { ...log, camperName: info.name, camperBunk: info.bunk };
      })
    );

    return { ...page, page: enriched };
  },
});
