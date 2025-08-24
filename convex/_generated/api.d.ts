/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as courses from "../courses.js";
import type * as dashboard from "../dashboard.js";
import type * as enrollments from "../enrollments.js";
import type * as grades from "../grades.js";
import type * as helpers from "../helpers.js";
import type * as professors from "../professors.js";
import type * as programs from "../programs.js";
import type * as reports from "../reports.js";
import type * as students from "../students.js";
import type * as types from "../types.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  courses: typeof courses;
  dashboard: typeof dashboard;
  enrollments: typeof enrollments;
  grades: typeof grades;
  helpers: typeof helpers;
  professors: typeof professors;
  programs: typeof programs;
  reports: typeof reports;
  students: typeof students;
  types: typeof types;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
