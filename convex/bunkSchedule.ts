import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { normDayType } from "./periodDays";

const DAY_OF_WEEK = v.union(
  v.literal("Mon"), v.literal("Tue"), v.literal("Wed"), v.literal("Thu"), v.literal("Fri"),
);

const PERIODS = [
  "Period1", "Period2", "Period3", "Period4", "Period5", "Period6", "Period7",
] as const;

// Mon–Thu share the "MonThu" per-camper schedule; Friday is its own. Used only
// to fall back to the legacy per-camper data for bunks that have no uploaded
// bunk schedule yet.
const dayTypeFor = (d: string): "MonThu" | "Friday" => (d === "Fri" ? "Friday" : "MonThu");

type Cell = { className: string; location?: string; count: number };

// The schedule board for a single weekday. Rows are periods, columns are bunks
// (ordered by the camp structure). Each cell prefers an uploaded bunk-schedule
// activity; a bunk with no uploaded schedule for the day falls back to the
// aggregated per-camper period records so nothing regresses.
export const gridForDay = query({
  args: { dayOfWeek: DAY_OF_WEEK },
  handler: async (ctx, { dayOfWeek }) => {
    const dt = dayTypeFor(dayOfWeek);

    const [cells, campers, classes, records, structure, trackDefs] = await Promise.all([
      ctx.db.query("bunkSchedule").withIndex("by_day", (q) => q.eq("dayOfWeek", dayOfWeek)).collect(),
      ctx.db.query("campers").collect(),
      ctx.db.query("periodClasses").collect(),
      ctx.db.query("periodScheduleRecords").collect(),
      ctx.db.query("campStructure").collect(),
      ctx.db.query("tracks").collect(),
    ]);

    const classMap = new Map(classes.map((c) => [c._id as string, c]));
    const camperMap = new Map(campers.map((c) => [c._id as string, c]));

    const bunkCamperCount = new Map<string, number>();
    for (const c of campers) {
      if (c.bunk) bunkCamperCount.set(c.bunk, (bunkCamperCount.get(c.bunk) ?? 0) + 1);
    }

    // ── Uploaded bunk schedule: bunk -> period -> Cell ──────────────────────
    const uploaded = new Map<string, Map<string, Cell>>();
    const uploadedBunks = new Set<string>();
    for (const cell of cells) {
      uploadedBunks.add(cell.bunk);
      let periods = uploaded.get(cell.bunk);
      if (!periods) { periods = new Map(); uploaded.set(cell.bunk, periods); }
      periods.set(cell.period, {
        className: cell.activity,
        location: cell.location,
        count: bunkCamperCount.get(cell.bunk) ?? 0,
      });
    }

    // ── Fallback per-camper aggregation (only used for non-uploaded bunks) ──
    // bunk -> period -> classKey -> Cell
    const agg = new Map<string, Map<string, Map<string, Cell>>>();
    for (const r of records) {
      if (r.isActive === false) continue;
      if (normDayType(r.dayType) !== dt) continue;
      const camper = camperMap.get(r.camperId as string);
      if (!camper?.bunk || uploadedBunks.has(camper.bunk)) continue;
      const cls = classMap.get(r.periodClassId as string);
      const className = cls?.className ?? r.classNameSnapshot;
      const key = (r.periodClassId as string) ?? className;
      let periods = agg.get(camper.bunk);
      if (!periods) { periods = new Map(); agg.set(camper.bunk, periods); }
      let byClass = periods.get(r.period);
      if (!byClass) { byClass = new Map(); periods.set(r.period, byClass); }
      const existing = byClass.get(key);
      if (existing) existing.count++;
      else byClass.set(key, { className, location: cls?.location, count: 1 });
    }

    // Middle-camp all-day tracks (fallback only, for non-uploaded bunks).
    const trackLoc = new Map(trackDefs.map((t) => [t.name, t.location]));
    const bunkTracks = new Map<string, Map<string, number>>();
    for (const c of campers) {
      if (!c.bunk || !c.track || uploadedBunks.has(c.bunk)) continue;
      let tm = bunkTracks.get(c.bunk);
      if (!tm) { tm = new Map(); bunkTracks.set(c.bunk, tm); }
      tm.set(c.track, (tm.get(c.track) ?? 0) + 1);
    }

    // ── Ordered bunk list: camp structure first, then camper-only bunks ─────
    const structByBunk = new Map(structure.map((s) => [s.bunk, s]));
    const seen = new Set<string>();
    const orderedBunks: string[] = [];
    const activeStruct = [...structure]
      .filter((s) => s.isActive !== false)
      .sort((a, b) =>
        (a.camp || "").localeCompare(b.camp || "") ||
        (a.division || "").localeCompare(b.division || "") ||
        (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) ||
        a.bunk.localeCompare(b.bunk));
    for (const s of activeStruct) {
      if (!seen.has(s.bunk)) { seen.add(s.bunk); orderedBunks.push(s.bunk); }
    }
    for (const b of [...bunkCamperCount.keys()].sort()) {
      if (!seen.has(b)) { seen.add(b); orderedBunks.push(b); }
    }

    const bunks = orderedBunks
      .filter((b) => bunkCamperCount.has(b) || uploaded.has(b) || structByBunk.has(b))
      .map((bunk) => {
        const s = structByBunk.get(bunk);
        const up = uploaded.get(bunk);
        const aggBunk = agg.get(bunk);
        const periodCells: Record<string, Cell[]> = {};
        for (const p of PERIODS) {
          if (up) {
            const cell = up.get(p);
            periodCells[p] = cell ? [cell] : [];
          } else {
            const byClass = aggBunk?.get(p);
            periodCells[p] = byClass
              ? [...byClass.values()].sort(
                  (a, b) => b.count - a.count || a.className.localeCompare(b.className),
                )
              : [];
          }
        }
        const tm = bunkTracks.get(bunk);
        const tracks = tm
          ? [...tm.entries()]
              .map(([name, count]) => ({ name, location: trackLoc.get(name), count }))
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          : [];
        return {
          bunk,
          displayName: s?.displayName ?? bunk,
          camp: s?.camp ?? null,
          division: s?.division ?? null,
          camperCount: bunkCamperCount.get(bunk) ?? 0,
          uploaded: !!up,
          periods: periodCells,
          tracks,
        };
      });

    return { dayOfWeek, periods: [...PERIODS], bunks };
  },
});

// A single bunk's full week (for editing / preview). bunk -> day -> period cell.
export const weekForBunk = query({
  args: { bunk: v.string() },
  handler: async (ctx, { bunk }) => {
    return await ctx.db
      .query("bunkSchedule")
      .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
      .collect();
  },
});

// Upsert one cell. Blank activity clears the cell.
export const setCell = mutation({
  args: {
    bunk: v.string(),
    dayOfWeek: DAY_OF_WEEK,
    period: v.string(),
    activity: v.string(),
    location: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, { bunk, dayOfWeek, period, activity, location, staffId }) => {
    const existing = await ctx.db
      .query("bunkSchedule")
      .withIndex("by_bunk_day_period", (q) =>
        q.eq("bunk", bunk).eq("dayOfWeek", dayOfWeek).eq("period", period))
      .first();
    const trimmed = activity.trim();
    if (!trimmed) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        activity: trimmed, location, updatedAt: Date.now(), updatedByStaffId: staffId,
      });
      return existing._id;
    }
    return await ctx.db.insert("bunkSchedule", {
      bunk, dayOfWeek, period, activity: trimmed, location,
      source: "manual", createdAt: Date.now(), updatedByStaffId: staffId,
    });
  },
});

// Bulk upload a week (or several bunks' weeks). Each row is one cell. Rows with a
// blank activity are skipped. Upserts by (bunk, dayOfWeek, period). When
// `replaceBunks` is true, every existing cell for the bunks touched by this
// upload is cleared first, so a re-upload is a clean replace rather than a merge.
export const weeklyUpload = mutation({
  args: {
    rows: v.array(v.object({
      bunk: v.string(),
      dayOfWeek: DAY_OF_WEEK,
      period: v.string(),
      activity: v.string(),
      location: v.optional(v.string()),
    })),
    replaceBunks: v.optional(v.boolean()),
    uploadBatchId: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, { rows, replaceBunks, uploadBatchId, staffId }) => {
    const now = Date.now();
    let created = 0, updated = 0, cleared = 0;

    if (replaceBunks) {
      const bunks = [...new Set(rows.map((r) => r.bunk))];
      for (const bunk of bunks) {
        const existing = await ctx.db
          .query("bunkSchedule")
          .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
          .collect();
        for (const e of existing) { await ctx.db.delete(e._id); cleared++; }
      }
    }

    for (const row of rows) {
      const activity = row.activity.trim();
      if (!activity) continue;
      const existing = replaceBunks
        ? null
        : await ctx.db
            .query("bunkSchedule")
            .withIndex("by_bunk_day_period", (q) =>
              q.eq("bunk", row.bunk).eq("dayOfWeek", row.dayOfWeek).eq("period", row.period))
            .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          activity, location: row.location, source: "upload", uploadBatchId,
          updatedAt: now, updatedByStaffId: staffId,
        });
        updated++;
      } else {
        await ctx.db.insert("bunkSchedule", {
          bunk: row.bunk, dayOfWeek: row.dayOfWeek, period: row.period, activity,
          location: row.location, source: "upload", uploadBatchId,
          createdAt: now, updatedByStaffId: staffId,
        });
        created++;
      }
    }
    return { created, updated, cleared };
  },
});

export const clearBunk = mutation({
  args: { bunk: v.string() },
  handler: async (ctx, { bunk }) => {
    const rows = await ctx.db
      .query("bunkSchedule")
      .withIndex("by_bunk", (q) => q.eq("bunk", bunk))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("bunkSchedule").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});
