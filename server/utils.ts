import type express from "express";
import { APP_URL } from "./config.js";
import fs from "fs";
import path from "path";

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

/**
 * Appends a message with a timestamp to a local log file in the workspace.
 */
export function logToFile(message: string): void {
  try {
    const logPath = path.join(process.cwd(), "server.log");
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    console.log(`[FILE_LOG] ${message}`);
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

