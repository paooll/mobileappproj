import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  exercises: defineTable({
    name: v.string(),
    muscleGroup: v.string(),
    equipment: v.string(),
  }).index("by_name", ["name"]),

  workouts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    date: v.string(), // YYYY-MM-DD
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  sets: defineTable({
    workoutId: v.id("workouts"),
    exerciseName: v.string(),
    weight: v.number(), // kg
    reps: v.number(),
    order: v.number(),
  }).index("by_workout", ["workoutId"]),

  bodyWeight: defineTable({
    userId: v.id("users"),
    date: v.string(),
    weight: v.number(),
  }).index("by_user", ["userId"]),
});
