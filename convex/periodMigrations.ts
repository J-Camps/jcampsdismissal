import { mutation } from "./_generated/server";

// One-time backfill: stamp every pre-existing period class / schedule / attendance
// record (which had no dayType) as "MonThu", so today's data lands cleanly in the
// Monday–Thursday bucket. Idempotent — only touches rows that lack a dayType.
export const backfillDayTypes = mutation({
  args: {},
  handler: async (ctx) => {
    let classes = 0;
    for (const c of await ctx.db.query("periodClasses").collect()) {
      if (c.dayType === undefined) {
        await ctx.db.patch(c._id, { dayType: "MonThu" });
        classes++;
      }
    }
    let schedules = 0;
    for (const s of await ctx.db.query("periodScheduleRecords").collect()) {
      if (s.dayType === undefined) {
        await ctx.db.patch(s._id, { dayType: "MonThu" });
        schedules++;
      }
    }
    let attendance = 0;
    for (const a of await ctx.db.query("periodAttendanceRecords").collect()) {
      if (a.dayType === undefined) {
        await ctx.db.patch(a._id, { dayType: "MonThu" });
        attendance++;
      }
    }
    return { classes, schedules, attendance };
  },
});
