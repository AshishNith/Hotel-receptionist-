import type express from "express";
import { APP_URL } from "./config.js";

/**
 * Resolves the publicly-reachable URL of this server by inspecting
 * forwarded headers, configured env, or falling back to request host.
 */
export function getPublicAppUrl(req: express.Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"]?.toString().split(",")[0];
  const forwardedHost = req.headers["x-forwarded-host"]?.toString().split(",")[0];
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const configuredUrl = APP_URL.trim();
  if (configuredUrl && configuredUrl !== "MY_APP_URL") {
    return configuredUrl.replace(/\/$/, "");
  }

  const proto = req.protocol || "http";
  const host = req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}
