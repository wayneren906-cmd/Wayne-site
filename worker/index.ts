import handler from "vinext/server/fetch-handler";
import { snapshot } from "../lib/database";

// 纯展示站点的统一边界：私有/旧管理页面跳转到公开展示页，站内内容编辑写接口停用。
// 只做路由级判断，不读取任何私有页面内容。
const REDIRECT_RULES: { prefix: string; target: string }[] = [
  { prefix: "/admin", target: "/learning" },
  { prefix: "/login", target: "/learning" },
  { prefix: "/studio/private", target: "/studio" },
  { prefix: "/studio/projects", target: "/studio" },
  { prefix: "/studio/roadmap", target: "/studio" },
  { prefix: "/studio/practice", target: "/studio" },
  { prefix: "/studio/archive", target: "/studio" },
  { prefix: "/projects", target: "/studio" },
];

// 站内内容编辑写接口；外部同步（/api/studio/ingest 等）、logout、快照与备份脚本不受影响。
const DISPLAY_ONLY_WRITE_PREFIXES = [
  "/api/admin/records",
  "/api/studio/projects",
  "/api/studio/plans",
  "/api/studio/events",
  "/api/auth/accounts",
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function normalizedPathname(request: Request): string | null {
  let pathname: string;
  try {
    // Match decoded path segments before the application router can expose an old editor.
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return null;
  }
  return pathname.replace(/\/{2,}/g, "/");
}

function displayOnlyBoundary(request: Request): Response | null {
  const pathname = normalizedPathname(request);
  if (pathname === null) return new Response('Invalid URL', {status:400,headers:{'Cache-Control':'no-store'}});

  for (const rule of REDIRECT_RULES) {
    if (!matchesPrefix(pathname, rule.prefix)) continue;
    let location = rule.target;
    try {
      const hash = new URL(request.url).hash;
      if (hash) location += hash;
    } catch {
      // 无法解析时保持基础跳转目标。
    }
    return new Response(null, {
      status: 303,
      headers: { Location: location, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    for (const prefix of DISPLAY_ONLY_WRITE_PREFIXES) {
      if (matchesPrefix(pathname, prefix)) {
        return Response.json(
          { error: "DISPLAY_ONLY", message: "本站为纯展示网站，不支持站内内容编辑。" },
          { status: 405, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  }

  return null;
}

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const boundary = displayOnlyBoundary(request);
    if (boundary) return boundary;
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Cloudflare.Env) {
    // Beijing 23:00 and 05:55, before the 06:00 cutoff; existing records only.
    await snapshot(env.DB, new Date(controller.scheduledTime));
  },
};
