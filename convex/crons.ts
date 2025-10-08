// convex/crons.ts

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Automatically clear all queues at midnight every day
 * This ensures a fresh start each morning for all campuses
 * 
 * Time: 00:00 Eastern Time (ET) = 05:00 UTC
 * Note: Adjust hourUTC based on your timezone
 * - EST (UTC-5): hourUTC: 5
 * - EDT (UTC-4): hourUTC: 4
 * - CST (UTC-6): hourUTC: 6, etc.
 */
crons.daily(
    "clear all queues at midnight",
    { hourUTC: 5, minuteUTC: 0 }, // Midnight ET (adjust based on your timezone)
    internal.queue.scheduledClearAllQueues
);

export default crons;
