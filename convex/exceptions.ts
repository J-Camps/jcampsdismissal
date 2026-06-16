import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const today = () => new Date().toISOString().split("T")[0];

// ─── Types ────────────────────────────────────────────────────────────────────

// Exception types — each corresponds to a specific gap between expected checkpoints.
// Severity: "high" = camper location unknown on campus | "medium" = handoff gap | "low" = timing issue
export type ExceptionType =
  | "CAMPUS_NOT_AT_BUNK"            // arrived (any method) but bunk not confirmed
  | "BC_SENT_NOT_AT_BUNK"           // BC marked sent-to-bunk but bunk not confirmed
  | "BUS_ONBOARD_NOT_AT_BUNK"       // bus room out but bunk not confirmed
  | "CALLED_NOT_PICKED_UP"          // called for pickup >30 min ago, still not dismissed
  | "SENT_TO_AC_NOT_CONFIRMED"      // bunk sent to AC but AC not checked in
  | "SENT_TO_BUSROOM_NOT_CONFIRMED" // bunk sent to bus room but not checked in
  | "RUNNER_NOT_DISMISSED";         // runner was assigned but camper never marked dismissed

export type ExceptionSeverity = "high" | "medium" | "low";

export interface AttendanceException {
  camperId:              string;
  camperName:            string;
  bunk:                  string;
  campSection?:          string;
  exceptionType:         ExceptionType;
  severity:              ExceptionSeverity;
  message:               string;          // human-readable short description
  detail:                string;          // longer admin detail
  lastCheckpoint:        string;
  lastCheckpointTime?:   number;
  lastCheckpointStaff?:  string;
  expectedNextCheckpoint: string;
  resolvedBy?:           string;
  resolvedAt?:           number;
  resolutionNote?:       string;
  isResolved:            boolean;
}

// ─── Live Exception Query ─────────────────────────────────────────────────────

export const getOpenExceptions = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const d = date ?? today();
    const campers = await ctx.db.query("campers").collect();
    const resolutions = await ctx.db
      .query("attendanceExceptions")
      .withIndex("by_date", q => q.eq("date", d))
      .collect();

    const resolvedMap = new Map<string, typeof resolutions[0]>();
    for (const r of resolutions) {
      resolvedMap.set(`${r.camperId}:${r.exceptionType}`, r);
    }

    const now = Date.now();
    const CALL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    const exceptions: AttendanceException[] = [];

    for (const c of campers) {
      if (c.arrivalStatus === "Absent") continue;

      const name = c.preferredName
        ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}`
        : c.name;

      // Determine if camper is known on campus (any morning arrival source recorded)
      const onCampusByCarline  = c.arrivalStatus === "Arrived" && !c.dailyCheckpoints?.BeforeCare;
      const onCampusByBC       = !!c.dailyCheckpoints?.BeforeCare;
      const bcSentToBunk       = !!c.dailyCheckpointsOut?.BeforeCare;
      const bunkConfirmed      = !!c.bunkConfirmed;
      const sentToAC           = !!c.leftEarly && (
        c.transportationType === "AfterCare" || !!c.afterCare ||
        c.dailyDismissalOverride === "AfterCare"
      );
      const acConfirmed        = !!c.dailyCheckpoints?.AfterCare;

      const makeKey = (type: ExceptionType) => `${c._id}:${type}`;
      const resolution = (type: ExceptionType) => resolvedMap.get(makeKey(type));

      // ── CAMPUS_NOT_AT_BUNK ─────────────────────────────────────────────────
      // Carline/Walk-In/Director arrival recorded but bunk not confirmed
      if (onCampusByCarline && !bunkConfirmed) {
        const r = resolution("CAMPUS_NOT_AT_BUNK");
        exceptions.push({
          camperId:   c._id,
          camperName: name,
          bunk:       c.bunk,
          campSection: c.campSection,
          exceptionType: "CAMPUS_NOT_AT_BUNK",
          severity:   "high",
          message:    "On campus but not confirmed at bunk",
          detail:     `Checked in at ${c.arrivalType ?? "unknown method"} but has not been confirmed at Bunk In.`,
          lastCheckpoint:         c.arrivalType ?? "Arrival",
          lastCheckpointTime:     undefined,
          expectedNextCheckpoint: "Bunk In",
          ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
        });
      }

      // ── BC_SENT_NOT_AT_BUNK ────────────────────────────────────────────────
      // Before Care marked them as sent to bunk, but bunk hasn't confirmed
      if (onCampusByBC && bcSentToBunk && !bunkConfirmed) {
        const r = resolution("BC_SENT_NOT_AT_BUNK");
        exceptions.push({
          camperId:   c._id,
          camperName: name,
          bunk:       c.bunk,
          campSection: c.campSection,
          exceptionType: "BC_SENT_NOT_AT_BUNK",
          severity:   "high",
          message:    "Sent from Before Care but not confirmed at bunk",
          detail:     "Camper was checked into Before Care and marked as sent to bunk, but the bunk counselor has not confirmed their arrival.",
          lastCheckpoint:         "Before Care Out / Sent to Bunk",
          expectedNextCheckpoint: "Bunk In",
          ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
        });
      }

      // ── CAMPUS_NOT_AT_BUNK (BC arrived but not yet sent, and not bunk confirmed)
      // Camper checked into BC but neither sent nor bunk confirmed
      if (onCampusByBC && !bcSentToBunk && !bunkConfirmed) {
        const r = resolution("CAMPUS_NOT_AT_BUNK");
        // Only add if not already added from carline path
        if (!exceptions.find(e => e.camperId === c._id && e.exceptionType === "CAMPUS_NOT_AT_BUNK")) {
          exceptions.push({
            camperId:   c._id,
            camperName: name,
            bunk:       c.bunk,
            campSection: c.campSection,
            exceptionType: "CAMPUS_NOT_AT_BUNK",
            severity:   "high",
            message:    "In Before Care but not confirmed at bunk",
            detail:     "Camper is checked into Before Care but has not been confirmed at their bunk.",
            lastCheckpoint:         "Before Care In",
            expectedNextCheckpoint: "Bunk In",
            ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
          });
        }
      }

      // ── CALLED_NOT_PICKED_UP ──────────────────────────────────────────────
      if ((c.status === "Called" || c.status === "Assigned") && c.tCalled) {
        const elapsed = now - c.tCalled;
        if (elapsed > CALL_TIMEOUT_MS) {
          const r = resolution("CALLED_NOT_PICKED_UP");
          exceptions.push({
            camperId:   c._id,
            camperName: name,
            bunk:       c.bunk,
            campSection: c.campSection,
            exceptionType: "CALLED_NOT_PICKED_UP",
            severity:   "medium",
            message:    `Called ${Math.floor(elapsed / 60000)} min ago, not yet picked up`,
            detail:     `Camper was called for pickup ${Math.floor(elapsed / 60000)} minutes ago and has not been marked dismissed.`,
            lastCheckpoint:         c.status === "Assigned" ? "Runner Assigned" : "Called",
            lastCheckpointTime:     c.tCalled,
            expectedNextCheckpoint: "Picked Up / Dismissed",
            ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
          });
        }
      }

      // ── SENT_TO_AC_NOT_CONFIRMED ──────────────────────────────────────────
      if (sentToAC && !acConfirmed) {
        const r = resolution("SENT_TO_AC_NOT_CONFIRMED");
        exceptions.push({
          camperId:   c._id,
          camperName: name,
          bunk:       c.bunk,
          campSection: c.campSection,
          exceptionType: "SENT_TO_AC_NOT_CONFIRMED",
          severity:   "high",
          message:    "Sent to After Care but not checked in",
          detail:     "Bunk marked camper as sent to After Care, but After Care has not confirmed their arrival.",
          lastCheckpoint:         "Bunk Out / Sent to After Care",
          expectedNextCheckpoint: "After Care In",
          ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
        });
      }

      // ── SENT_TO_BUSROOM_NOT_CONFIRMED ─────────────────────────────────────
      // Bunk sent camper to bus room but bus room has not confirmed arrival.
      // We track this via dailyCheckpointsOut.Bus = true (bunk sent) vs
      // dailyCheckpoints.Bus = true (bus room confirmed).
      const sentToBusRoom = !!c.dailyCheckpointsOut?.Bus;
      const busRoomConfirmed = !!c.dailyCheckpoints?.Bus;
      if (sentToBusRoom && !busRoomConfirmed) {
        const r = resolution("SENT_TO_BUSROOM_NOT_CONFIRMED");
        exceptions.push({
          camperId:   c._id,
          camperName: name,
          bunk:       c.bunk,
          campSection: c.campSection,
          exceptionType: "SENT_TO_BUSROOM_NOT_CONFIRMED",
          severity:   "high",
          message:    "Sent to Bus Room but not checked in",
          detail:     "Bunk marked camper as sent to Bus Room, but Bus Room staff have not confirmed their arrival.",
          lastCheckpoint:         "Bunk Out / Sent to Bus Room",
          expectedNextCheckpoint: "Bus Room In",
          ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
        });
      }

      // ── RUNNER_NOT_DISMISSED ──────────────────────────────────────────────
      // A runner was assigned and picked up the camper, but the camper was never
      // marked as dismissed. This catches runners who forget to close the loop.
      const RUNNER_DISMISS_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
      if (c.status === "Picked Up" && c.tPickedUp) {
        const elapsed = now - c.tPickedUp;
        if (elapsed > RUNNER_DISMISS_TIMEOUT_MS) {
          const r = resolution("RUNNER_NOT_DISMISSED");
          exceptions.push({
            camperId:   c._id,
            camperName: name,
            bunk:       c.bunk,
            campSection: c.campSection,
            exceptionType: "RUNNER_NOT_DISMISSED",
            severity:   "medium",
            message:    `Runner picked up ${Math.floor(elapsed / 60000)} min ago, not dismissed`,
            detail:     `Camper was marked "Picked Up" by ${c.runner ?? "a runner"} ${Math.floor(elapsed / 60000)} minutes ago but has not been marked as Dismissed.`,
            lastCheckpoint:         "Runner Picked Up",
            lastCheckpointTime:     c.tPickedUp,
            expectedNextCheckpoint: "Dismissed",
            ...(r ? { resolvedBy: r.resolvedBy, resolvedAt: r.resolvedAt, resolutionNote: r.resolutionNote, isResolved: true } : { isResolved: false }),
          });
        }
      }
    }

    return exceptions;
  },
});

// Filtered to one bunk — used by counselor view to show only their actionable alerts.
export const getBunkExceptions = query({
  args: { bunk: v.string(), date: v.optional(v.string()) },
  handler: async (ctx, { bunk, date }) => {
    const d = date ?? today();
    const campers = await ctx.db
      .query("campers")
      .withIndex("by_bunk", q => q.eq("bunk", bunk))
      .collect();

    const resolutions = await ctx.db
      .query("attendanceExceptions")
      .withIndex("by_date", q => q.eq("date", d))
      .collect();

    const resolvedMap = new Map<string, typeof resolutions[0]>();
    for (const r of resolutions) {
      resolvedMap.set(`${r.camperId}:${r.exceptionType}`, r);
    }

    const exceptions: AttendanceException[] = [];

    for (const c of campers) {
      if (c.arrivalStatus === "Absent") continue;

      const name = c.preferredName
        ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}`
        : c.name;

      const onCampus    = c.arrivalStatus === "Arrived" || !!c.dailyCheckpoints?.BeforeCare;
      const bcSentToBunk = !!c.dailyCheckpointsOut?.BeforeCare;
      const bunkConfirmed = !!c.bunkConfirmed;

      const resolution = (type: ExceptionType) =>
        resolvedMap.get(`${c._id}:${type}`);

      // Show counselor: any case where camper is on campus but not confirmed at their bunk
      if (onCampus && !bunkConfirmed) {
        const type: ExceptionType = bcSentToBunk ? "BC_SENT_NOT_AT_BUNK" : "CAMPUS_NOT_AT_BUNK";
        const r = resolution(type);
        if (!r) {
          // Only unresolved exceptions surface to counselor
          exceptions.push({
            camperId:   c._id,
            camperName: name,
            bunk:       c.bunk,
            campSection: c.campSection,
            exceptionType: type,
            severity:   "high",
            message:    bcSentToBunk
              ? "Sent from Before Care — not confirmed at bunk"
              : `Checked in via ${c.arrivalType ?? "carline"} — not confirmed at bunk`,
            detail:     "",
            lastCheckpoint:         bcSentToBunk ? "Before Care Out" : (c.arrivalType ?? "Carline In"),
            expectedNextCheckpoint: "Bunk In",
            isResolved: false,
          });
        }
      }
    }

    return exceptions;
  },
});

// ─── Resolve an exception ─────────────────────────────────────────────────────

export const resolveException = mutation({
  args: {
    camperId:       v.id("campers"),
    exceptionType:  v.string(),
    resolvedBy:     v.string(),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, { camperId, exceptionType, resolvedBy, resolutionNote }) => {
    const d = today();
    // Remove any existing resolution for this camper+type+date before inserting fresh
    const existing = await ctx.db
      .query("attendanceExceptions")
      .withIndex("by_camper_date", q => q.eq("camperId", camperId).eq("date", d))
      .collect();
    for (const e of existing) {
      if (e.exceptionType === exceptionType) await ctx.db.delete(e._id);
    }
    await ctx.db.insert("attendanceExceptions", {
      camperId,
      date:          d,
      exceptionType,
      resolvedBy,
      resolvedAt:    Date.now(),
      resolutionNote,
    });
  },
});
