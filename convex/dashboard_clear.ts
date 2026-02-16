import { internalMutation } from "./_generated/server";

export const clearDashboardMetrics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const metrics = await ctx.db.query("dashboardMetrics").collect();
    const topArrivals = await ctx.db.query("dashboardTopArrivals").collect();

    for (const metric of metrics) {
      await ctx.db.delete(metric._id);
    }

    for (const arrival of topArrivals) {
      await ctx.db.delete(arrival._id);
    }

    console.log(
      `[Dashboard Clear] Deleted ${metrics.length} metrics and ${topArrivals.length} top arrivals`
    );

    return {
      success: true,
      deletedMetrics: metrics.length,
      deletedTopArrivals: topArrivals.length,
    };
  },
});
