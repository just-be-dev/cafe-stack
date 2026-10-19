import type { AppEnv } from "./stack.ts";

export default {
  fetch(request: Request, env: AppEnv): Promise<Response> {
    // Under a base path (`/app/api/health`), hand the API the path
    // it knows (`/api/health`).
    const base = env.BASE_PATH.replace(/\/$/, "");
    const url = new URL(request.url);
    if (base !== "" && url.pathname.startsWith(`${base}/`)) {
      url.pathname = url.pathname.slice(base.length);
      return env.API.fetch(new Request(url, request));
    }
    return env.API.fetch(request);
  },
};
