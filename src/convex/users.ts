import { auth } from "./auth";
import { query } from "./_generated/server";

export const loggedInUser = query({
  handler: async (ctx) => {
    return await auth.getUserId(ctx);
  },
});
