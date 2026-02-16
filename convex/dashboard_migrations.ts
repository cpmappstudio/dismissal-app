import { internalMutation } from "./_generated/server";

export const normalizeCampusNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("dismissalHistory")
      .filter((q) => q.eq(q.field("campusLocation"), "Downtown Middle"))
      .collect();

    let updated = 0;
    for (const record of records) {
      await ctx.db.patch(record._id, {
        campusLocation: "DownTown Middle",
      });
      updated++;
    }

    console.log(`[Migration] Updated ${updated} records from "Downtown Middle" to "DownTown Middle"`);
    return { updated };
  },
});
