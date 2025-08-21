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
import type * as enrollments from "../enrollments.js";
import type * as helpers from "../helpers.js";
import type * as periods from "../periods.js";
import type * as professorDashboard from "../professorDashboard.js";
import type * as programs from "../programs.js";
import type * as sections from "../sections.js";
import type * as studentDashboard from "../studentDashboard.js";
import type * as types from "../types.js";
import type * as users from "../users.js";

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
  enrollments: typeof enrollments;
  helpers: typeof helpers;
  periods: typeof periods;
  professorDashboard: typeof professorDashboard;
  programs: typeof programs;
  sections: typeof sections;
  studentDashboard: typeof studentDashboard;
  types: typeof types;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
