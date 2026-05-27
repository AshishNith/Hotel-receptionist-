import { Router } from "express";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    model: GEMINI_MODEL,
    env: {
      has_api_key: !!GEMINI_API_KEY,
    },
  });
});

export default router;
