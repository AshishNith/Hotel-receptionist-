import { Router } from "express";
import { KnowledgeBaseModel } from "../models/KnowledgeBase.js";
import { validateKnowledgeBase } from "../validators/index.js";

const router = Router();

// GET /api/knowledge-bases — List all knowledge bases
router.get("/", async (_req, res) => {
  try {
    const kbs = await KnowledgeBaseModel.find({});
    res.json({ success: true, data: kbs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/knowledge-bases — Create or update a knowledge base
router.post("/", async (req, res) => {
  const kb = req.body;
  const validationError = validateKnowledgeBase(kb);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const sanitizedDocs = kb.documents.map((d: any) => ({
    id: d.id.trim(),
    title: d.title.trim(),
    content: d.content.trim(),
  }));

  const sanitizedKb = {
    id: kb.id.trim(),
    name: kb.name.trim(),
    description: kb.description.trim(),
    documents: sanitizedDocs,
  };

  try {
    await KnowledgeBaseModel.findOneAndUpdate(
      { id: sanitizedKb.id },
      sanitizedKb,
      { upsert: true, returnDocument: "after" }
    );
    const count = await KnowledgeBaseModel.countDocuments({});
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/knowledge-bases/:id — Delete a knowledge base
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await KnowledgeBaseModel.deleteOne({ id });
    const count = await KnowledgeBaseModel.countDocuments({});
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
