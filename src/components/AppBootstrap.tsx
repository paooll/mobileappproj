import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function AppBootstrap() {
  const seed = useMutation(api.exerciseSeed.seed);
  useEffect(() => {
    seed().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
