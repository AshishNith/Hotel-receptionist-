import { Router } from "express";
import { SettingsModel, getGlobalSettings } from "../models/Settings.js";

const router = Router();

/**
 * GET /api/settings — Returns settings with sensitive fields masked for frontend display.
 */
router.get("/", async (_req, res) => {
  try {
    const settings = await getGlobalSettings();
    const obj = (settings as any).toObject ? (settings as any).toObject() : settings;

    // Mask sensitive fields for frontend
    const masked = {
      ...obj,
      vobiz: {
        authId: maskValue(obj.vobiz?.authId),
        authToken: maskValue(obj.vobiz?.authToken),
        fromNumber: obj.vobiz?.fromNumber || "",
      },
      gemini: {
        apiKey: maskValue(obj.gemini?.apiKey),
        model: obj.gemini?.model || "",
      },
    };

    res.json({ success: true, data: masked });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/settings/full — Returns unmasked settings (for server-side internal use).
 * NOTE: In a production multi-tenant system, this would be auth-gated.
 */
router.get("/full", async (_req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json({ success: true, data: (settings as any).toObject ? (settings as any).toObject() : settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/settings — Updates settings. Supports partial updates via deep merge.
 */
router.put("/", async (req, res) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ success: false, message: "Invalid settings payload." });
    }

    // Build flat update object for MongoDB $set to support partial nested updates
    const setObj: Record<string, any> = {};

    if (updates.brand && typeof updates.brand === "object") {
      for (const [k, v] of Object.entries(updates.brand)) {
        setObj[`brand.${k}`] = v;
      }
    }

    if (updates.user && typeof updates.user === "object") {
      for (const [k, v] of Object.entries(updates.user)) {
        setObj[`user.${k}`] = v;
      }
    }

    if (updates.vobiz && typeof updates.vobiz === "object") {
      // Only update non-masked values (if frontend sends "••••••••", skip it)
      for (const [k, v] of Object.entries(updates.vobiz)) {
        if (typeof v === "string" && v.includes("••••")) continue; // skip masked values
        setObj[`vobiz.${k}`] = v;
      }
    }

    if (updates.googleSheets && typeof updates.googleSheets === "object") {
      for (const [k, v] of Object.entries(updates.googleSheets)) {
        setObj[`googleSheets.${k}`] = v;
      }
    }

    if (updates.gemini && typeof updates.gemini === "object") {
      for (const [k, v] of Object.entries(updates.gemini)) {
        if (typeof v === "string" && v.includes("••••")) continue; // skip masked values
        setObj[`gemini.${k}`] = v;
      }
    }

    if (updates.credits && typeof updates.credits === "object") {
      for (const [k, v] of Object.entries(updates.credits)) {
        setObj[`credits.${k}`] = v;
      }
    }

    if (updates.features && typeof updates.features === "object") {
      for (const [k, v] of Object.entries(updates.features)) {
        setObj[`features.${k}`] = v;
      }
    }

    setObj["updatedAt"] = new Date();

    const result = await SettingsModel.findOneAndUpdate(
      { _key: "global" },
      { $set: setObj },
      { upsert: true, returnDocument: "after" }
    );

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Helper ─────────────────────────────────────────────────────

function maskValue(val?: string): string {
  if (!val || val.length === 0) return "";
  if (val.length <= 6) return "••••••••";
  return val.substring(0, 3) + "••••••••" + val.substring(val.length - 3);
}

export default router;
