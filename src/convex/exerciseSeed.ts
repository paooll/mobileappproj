import { mutation } from "./_generated/server";

const EXERCISES: [string, string, string][] = [
  ["Bench Press", "Chest", "Barbell"],
  ["Incline Dumbbell Press", "Chest", "Dumbbell"],
  ["Push-Up", "Chest", "Bodyweight"],
  ["Cable Fly", "Chest", "Cable"],
  ["Deadlift", "Back", "Barbell"],
  ["Barbell Row", "Back", "Barbell"],
  ["Lat Pulldown", "Back", "Cable"],
  ["Pull-Up", "Back", "Bodyweight"],
  ["Overhead Press", "Shoulders", "Barbell"],
  ["Lateral Raise", "Shoulders", "Dumbbell"],
  ["Face Pull", "Shoulders", "Cable"],
  ["Squat", "Legs", "Barbell"],
  ["Leg Press", "Legs", "Machine"],
  ["Romanian Deadlift", "Legs", "Barbell"],
  ["Lunge", "Legs", "Dumbbell"],
  ["Leg Curl", "Legs", "Machine"],
  ["Calf Raise", "Legs", "Machine"],
  ["Barbell Curl", "Arms", "Barbell"],
  ["Hammer Curl", "Arms", "Dumbbell"],
  ["Tricep Pushdown", "Arms", "Cable"],
  ["Skullcrusher", "Arms", "Barbell"],
  ["Plank", "Core", "Bodyweight"],
  ["Hanging Leg Raise", "Core", "Bodyweight"],
  ["Cable Crunch", "Core", "Cable"],
  ["Russian Twist", "Core", "Bodyweight"],
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("exercises").collect();
    if (existing.length > 0) return;
    for (const [name, muscleGroup, equipment] of EXERCISES) {
      await ctx.db.insert("exercises", { name, muscleGroup, equipment });
    }
  },
});
