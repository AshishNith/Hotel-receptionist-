import { Router } from "express";
import { allToolDeclarations } from "../services/gemini.js";
import { GoogleTokenModel } from "../models/GoogleToken.js";
import { GOOGLE_CLIENT_ID } from "../config.js";
import fs from "fs";
import path from "path";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    // Check Google Auth configuration/status
    const googleTokensCount = await GoogleTokenModel.countDocuments({ refresh_token: { $exists: true } });
    const isGoogleConfigured = !!GOOGLE_CLIENT_ID;

    // Check E-commerce CSV database files existence
    const DATA_DIR = path.resolve(process.cwd(), "data");
    const ordersExist = fs.existsSync(path.join(DATA_DIR, "orders.csv"));
    const cartsExist = fs.existsSync(path.join(DATA_DIR, "abandoned_carts.csv"));
    const faqsExist = fs.existsSync(path.join(DATA_DIR, "store_faq.csv"));

    const toolsWithStatus = allToolDeclarations.map((tool) => {
      let status: "active" | "error" | "needs_auth" | "not_configured" = "active";
      let statusDetails = "Ready to be called by agent.";

      const googleTools = ["list_upcoming_meetings", "create_calendar_event", "send_gmail_message", "read_latest_emails"];
      if (googleTools.includes(tool.name)) {
        if (!isGoogleConfigured) {
          status = "not_configured";
          statusDetails = "Google client credentials missing in server .env file.";
        } else if (googleTokensCount === 0) {
          status = "needs_auth";
          statusDetails = "No Google accounts authenticated. Please link your Google account in the Agents page.";
        } else {
          status = "active";
          statusDetails = `Active with ${googleTokensCount} authenticated connection(s).`;
        }
      } else {
        // E-commerce tools
        if (!ordersExist || !cartsExist || !faqsExist) {
          status = "error";
          statusDetails = "E-commerce database files (orders, carts, or FAQ) missing in data/ folder.";
        } else {
          status = "active";
          statusDetails = "E-commerce store database files are online and writeable.";
        }
      }

      return {
        ...tool,
        status,
        statusDetails
      };
    });

    res.json({ success: true, data: toolsWithStatus });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test invocation route
router.post("/:name/test", async (req, res) => {
  const { name } = req.params;
  const args = req.body.args || {};

  try {
    const { executeToolCalls } = await import("../services/toolExecutor.js");
    
    let phoneKey = "default";
    const token = await GoogleTokenModel.findOne({});
    if (token) {
      phoneKey = token.phoneKey;
    }

    const result = await executeToolCalls([{ id: "test-call-id", name, args }], phoneKey);
    res.json({ success: true, result: result[0]?.response || null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
