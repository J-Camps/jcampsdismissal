/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendanceLogs from "../attendanceLogs.js";
import type * as busRoutes from "../busRoutes.js";
import type * as campStructure from "../campStructure.js";
import type * as campers from "../campers.js";
import type * as dailyOverrides from "../dailyOverrides.js";
import type * as exceptions from "../exceptions.js";
import type * as lunchRecords from "../lunchRecords.js";
import type * as periodAttendance from "../periodAttendance.js";
import type * as periodClasses from "../periodClasses.js";
import type * as periodDays from "../periodDays.js";
import type * as periodMigrations from "../periodMigrations.js";
import type * as periodScheduleRecords from "../periodScheduleRecords.js";
import type * as periodSchedules from "../periodSchedules.js";
import type * as staff from "../staff.js";
import type * as staffAssignments from "../staffAssignments.js";
import type * as uploadBatches from "../uploadBatches.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendanceLogs: typeof attendanceLogs;
  busRoutes: typeof busRoutes;
  campStructure: typeof campStructure;
  campers: typeof campers;
  dailyOverrides: typeof dailyOverrides;
  exceptions: typeof exceptions;
  lunchRecords: typeof lunchRecords;
  periodAttendance: typeof periodAttendance;
  periodClasses: typeof periodClasses;
  periodDays: typeof periodDays;
  periodMigrations: typeof periodMigrations;
  periodScheduleRecords: typeof periodScheduleRecords;
  periodSchedules: typeof periodSchedules;
  staff: typeof staff;
  staffAssignments: typeof staffAssignments;
  uploadBatches: typeof uploadBatches;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
