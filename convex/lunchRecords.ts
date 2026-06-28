import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getForDate = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const d = date ?? new Date().toISOString().split("T")[0];
    return await ctx.db
      .query("lunchRecords")
      .withIndex("by_date", (q) => q.eq("date", d))
      .collect();
  },
});

export const getForWeek = query({
  args: { weekStartDate: v.string() },
  handler: async (ctx, { weekStartDate }) => {
    return await ctx.db
      .query("lunchRecords")
      .withIndex("by_week", (q) => q.eq("weekStartDate", weekStartDate))
      .collect();
  },
});

export const getForCamperDate = query({
  args: { camperId: v.id("campers"), date: v.optional(v.string()) },
  handler: async (ctx, { camperId, date }) => {
    const d = date ?? new Date().toISOString().split("T")[0];
    return await ctx.db
      .query("lunchRecords")
      .withIndex("by_camper_date", (q) => q.eq("camperId", camperId).eq("date", d))
      .first();
  },
});

export const getForCamperWeek = query({
  args: { camperId: v.id("campers"), weekStartDate: v.string() },
  handler: async (ctx, { camperId, weekStartDate }) => {
    const all = await ctx.db
      .query("lunchRecords")
      .withIndex("by_week", (q) => q.eq("weekStartDate", weekStartDate))
      .collect();
    return all.filter((r) => r.camperId === camperId);
  },
});

export const markPickedUp = mutation({
  args: {
    id: v.id("lunchRecords"),
    pickedUp: v.boolean(),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, { id, pickedUp, staffId }) => {
    await ctx.db.patch(id, {
      pickedUp,
      pickedUpAt: pickedUp ? Date.now() : undefined,
      pickedUpByStaffId: pickedUp ? staffId : undefined,
    });
  },
});

function getWeekDates(weekStart: string): string[] {
  const d = new Date(weekStart + "T00:00:00");
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    dates.push(day.toISOString().split("T")[0]);
  }
  return dates;
}

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function parseAltLunchDays(altLunch: string): Set<string> {
  if (!altLunch.trim()) return new Set();
  return new Set(
    altLunch
      .split("|")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => DAY_NAMES.includes(s))
  );
}

export const weeklyUpload = mutation({
  args: {
    weekStartDate: v.string(),
    records: v.array(
      v.object({
        camperId: v.id("campers"),
        altLunch: v.optional(v.string()),
        note: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { weekStartDate, records }) => {
    const dates = getWeekDates(weekStartDate);
    let created = 0;
    let updated = 0;

    for (const rec of records) {
      const altDays = parseAltLunchDays(rec.altLunch ?? "");

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dayName = DAY_NAMES[i];
        const lunchType = altDays.has(dayName) ? "alternate" as const : "regular" as const;

        const existing = await ctx.db
          .query("lunchRecords")
          .withIndex("by_camper_date", (q) =>
            q.eq("camperId", rec.camperId).eq("date", date)
          )
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, {
            weekStartDate,
            lunchType,
            note: rec.note,
          });
          updated++;
        } else {
          await ctx.db.insert("lunchRecords", {
            camperId: rec.camperId,
            weekStartDate,
            date,
            lunchType,
            note: rec.note,
            pickedUp: false,
          });
          created++;
        }
      }
    }
    return { created, updated };
  },
});

export const clearWeek = mutation({
  args: { weekStartDate: v.string() },
  handler: async (ctx, { weekStartDate }) => {
    const all = await ctx.db
      .query("lunchRecords")
      .withIndex("by_week", (q) => q.eq("weekStartDate", weekStartDate))
      .collect();
    for (const r of all) await ctx.db.delete(r._id);
    return all.length;
  },
});
