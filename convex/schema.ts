import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const STATUS = v.union(
  v.literal("Waiting"),
  v.literal("Called"),
  v.literal("Assigned"),
  v.literal("Picked Up"),
  v.literal("Dismissed"),
);

export const SOURCE = v.union(v.literal("Carline"), v.literal("Walk-Up"));

export const ATTENDANCE_STATUS = v.union(
  v.literal("Present"),
  v.literal("Absent"),
  v.literal("Expected Late"),
  v.literal("Dismissed Early"),
  v.literal("Already Dismissed"),
);

export default defineSchema({
  campers: defineTable({
    name: v.string(),
    bunk: v.string(),
    code: v.string(),
    status: STATUS,
    callSource: v.optional(SOURCE),
    runner: v.optional(v.string()),
    note: v.optional(v.string()),
    tCalled: v.optional(v.number()),
    tAssigned: v.optional(v.number()),
    tPickedUp: v.optional(v.number()),
    tDismissed: v.optional(v.number()),
    attendanceStatus: v.optional(ATTENDANCE_STATUS),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_runner", ["runner"]),
});
