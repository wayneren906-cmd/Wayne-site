import handler from "vinext/server/fetch-handler";
import { snapshot } from "../lib/database";
export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Cloudflare.Env) {
    // Beijing 23:00 and 05:55, before the 06:00 cutoff; existing records only.
    await snapshot(env.DB, new Date(controller.scheduledTime));
  },
};
