import { defineRoute } from "@/lib/route";
import { runWatchPriceCheck, watchPriceCheckRequestSchema } from "@/lib/watch-check";

export const dynamic = "force-dynamic";

export const POST = defineRoute(watchPriceCheckRequestSchema, async (args) => {
  return runWatchPriceCheck(args);
});
