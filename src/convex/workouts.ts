import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("workouts") },
  handler: async (ctx, { id }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const workout = await ctx.db.get(id);
    if (!workout || workout.userId !== userId) return null;
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_workout", (q) => q.eq("workoutId", id))
      .collect();
    sets.sort((a, b) => a.order - b.order);
    return { ...workout, sets };
  },
});

export const active = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const all = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return all.find((w) => !w.completedAt) ?? null;
  },
});

export const start = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (existing && !existing.completedAt) return existing._id;
    const date = new Date().toISOString().slice(0, 10);
    return await ctx.db.insert("workouts", {
      userId,
      name,
      date,
      startedAt: Date.now(),
    });
  },
});

export const addSet = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseName: v.string(),
    weight: v.number(),
    reps: v.number(),
  },
  handler: async (ctx, { workoutId, exerciseName, weight, reps }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const workout = await ctx.db.get(workoutId);
    if (!workout || workout.userId !== userId) throw new Error("Not found");
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_workout", (q) => q.eq("workoutId", workoutId))
      .collect();
    return await ctx.db.insert("sets", {
      workoutId,
      exerciseName,
      weight,
      reps,
      order: sets.length,
    });
  },
});

export const removeSet = mutation({
  args: { setId: v.id("sets") },
  handler: async (ctx, { setId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const set = await ctx.db.get(setId);
    if (!set) return;
    const workout = await ctx.db.get(set.workoutId);
    if (!workout || workout.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(setId);
  },
});

export const finish = mutation({
  args: { workoutId: v.id("workouts"), notes: v.optional(v.string()) },
  handler: async (ctx, { workoutId, notes }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const workout = await ctx.db.get(workoutId);
    if (!workout || workout.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(workoutId, { completedAt: Date.now(), notes });
  },
});

export const remove = mutation({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, { workoutId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const workout = await ctx.db.get(workoutId);
    if (!workout || workout.userId !== userId) throw new Error("Not found");
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_workout", (q) => q.eq("workoutId", workoutId))
      .collect();
    for (const s of sets) await ctx.db.delete(s._id);
    await ctx.db.delete(workoutId);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const completed = workouts.filter((w) => w.completedAt);
    const workoutIds = new Set(completed.map((w) => w._id));
    const allSets = await ctx.db.query("sets").collect();
    const mySets = allSets.filter((s) => workoutIds.has(s.workoutId));
    const totalVolume = mySets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    // streak: consecutive days ending today or yesterday
    const dates = new Set(completed.map((w) => w.date));
    let streak = 0;
    const d = new Date();
    if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (dates.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return {
      totalWorkouts: completed.length,
      totalSets: mySets.length,
      totalVolume,
      streak,
    };
  },
});
