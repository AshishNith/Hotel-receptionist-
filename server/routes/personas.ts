import { Router } from "express";
import { PersonaModel } from "../models/Persona.js";
import { validatePersona } from "../validators/index.js";

const router = Router();

// GET /api/personas — List all personas
router.get("/", async (_req, res) => {
  try {
    const allPersonas = await PersonaModel.find({});
    res.json({ success: true, data: allPersonas });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/personas — Create or update a persona
router.post("/", async (req, res) => {
  const agent = req.body;
  const validationError = validatePersona(agent);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const sanitizedAgent = {
    id: agent.id.trim(),
    name: agent.name.trim(),
    role: agent.role.trim(),
    description: agent.description ? agent.description.trim() : undefined,
    voice: agent.voice.trim(),
    systemInstruction: agent.systemInstruction.trim(),
    accentColor: agent.accentColor,
    bgColor: agent.bgColor ? agent.bgColor.trim() : undefined,
    borderColor: agent.borderColor ? agent.borderColor.trim() : undefined,
    avatar: agent.avatar ? agent.avatar.trim() : undefined,
    initialGreeting: agent.initialGreeting ? agent.initialGreeting.trim() : undefined,
    phoneNumber: agent.phoneNumber ? agent.phoneNumber.trim() : undefined,
    knowledgeBaseId: agent.knowledgeBaseId ? agent.knowledgeBaseId.trim() : undefined,
    ambientSound: agent.ambientSound || "none",
    silenceTimeout: agent.silenceTimeout || 30,
    temperature: typeof agent.temperature === "number" ? agent.temperature : 0.7,
    isDefault: agent.id.trim() === "cod_confirm" || !!agent.isDefault,
    enabledTools: agent.enabledTools,
  };

  try {
    await PersonaModel.findOneAndUpdate(
      { id: sanitizedAgent.id },
      sanitizedAgent,
      { upsert: true, returnDocument: "after" }
    );
    const count = await PersonaModel.countDocuments({ isDefault: { $ne: true } });
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/personas/:id — Delete a persona (not defaults)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const persona = await PersonaModel.findOne({ id });
    if (persona && persona.isDefault) {
      return res.status(400).json({ success: false, message: "Cannot delete built-in default personas." });
    }
    await PersonaModel.deleteOne({ id });
    const count = await PersonaModel.countDocuments({ isDefault: { $ne: true } });
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
