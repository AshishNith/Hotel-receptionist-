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

  // Re-read .env dynamically to get the latest APP_URL if not forwarded
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      const match = envContent.match(/^APP_URL=["']?([^"'\r\n]+)/m);
      if (match && match[1]) {
        const dynamicUrl = match[1].trim();
        if (dynamicUrl && dynamicUrl !== "MY_APP_URL") {
          return dynamicUrl.replace(/\/$/, "");
        }
      }
    }
  } catch (err) {
    console.error("Failed to read dynamic APP_URL from .env:", err);
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

/**
 * Parses a date string supporting YYYY-MM-DD, DD/MM/YYYY, and DD-MM-YYYY formats.
 * Returns a Date object or null if parsing fails.
 */
export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Try default ISO parsing first
  let d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;

  // Split by common delimiters
  const parts = trimmed.split(/[-/.]/);
  if (parts.length === 3) {
    // Format: DD/MM/YYYY or DD-MM-YYYY
    if (parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
      const year = parseInt(parts[2], 10);
      d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    // Format: YYYY/MM/DD or YYYY-MM-DD
    if (parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}


