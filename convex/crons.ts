// convex/crons.ts

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { DAILY_RESET_UTC } from "../lib/operational-day";

const crons = cronJobs();

/**
 * Automatically clear the previous day's queues at the shared daily cutoff
 * and aggregate dashboard metrics for the previous operational day.
 * This ensures a fresh start each morning for all campuses.
 * 05:00 UTC is midnight EST / 01:00 EDT, not local midnight year-round.
 */
crons.daily(
    "clear all queues at midnight",
    DAILY_RESET_UTC,
    internal.queue.scheduledClearAllQueues
);

export default crons;
