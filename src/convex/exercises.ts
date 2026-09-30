import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("exercises").collect();
  },
});

export const byMuscleGroup = query({
  args: { muscleGroup: v.string() },
  handler: async (ctx, { muscleGroup }) => {
    const all = await ctx.db.query("exercises").collect();
    return all.filter((e) => e.muscleGroup === muscleGroup);
  },
});
