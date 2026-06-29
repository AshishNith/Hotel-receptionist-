// ─── Persona Validator ──────────────────────────────────────────

const VALID_ACCENT_COLORS = ["emerald", "amber", "indigo", "rose", "cyan", "pink", "green"];
const VALID_AMBIENT_SOUNDS = ["none", "office", "cafe", "airport"];

export function validatePersona(persona: any): string | null {
  if (!persona || typeof persona !== "object") {
    return "Invalid persona payload";
  }

  const requiredFields = ["id", "name", "role", "voice", "systemInstruction", "accentColor"];
  for (const field of requiredFields) {
    if (typeof persona[field] !== "string") {
      return `Field '${field}' must be a string`;
    }
  }

  const idRegex = /^[a-zA-Z0-9-_]+$/;
  if (!idRegex.test(persona.id) || persona.id.length > 50) {
    return "Field 'id' must be alphanumeric (dashes/underscores allowed) and between 1 and 50 characters";
  }
  if (persona.name.trim().length === 0 || persona.name.length > 100) {
    return "Field 'name' must be between 1 and 100 characters";
  }
  if (persona.role.trim().length === 0 || persona.role.length > 100) {
    return "Field 'role' must be between 1 and 100 characters";
  }
  if (persona.voice.trim().length === 0 || persona.voice.length > 50) {
    return "Field 'voice' must be between 1 and 50 characters";
  }
  if (persona.systemInstruction.trim().length === 0 || persona.systemInstruction.length > 5000) {
    return "Field 'systemInstruction' must be between 1 and 5000 characters";
  }
  if (!VALID_ACCENT_COLORS.includes(persona.accentColor)) {
    return `Field 'accentColor' must be one of: ${VALID_ACCENT_COLORS.join(", ")}`;
  }

  if (persona.knowledgeBaseId != null && persona.knowledgeBaseId !== "") {
    if (typeof persona.knowledgeBaseId !== "string" || persona.knowledgeBaseId.length > 50) {
      return "Field 'knowledgeBaseId' must be a string up to 50 characters";
    }
  }
  if (persona.ambientSound != null) {
    if (!VALID_AMBIENT_SOUNDS.includes(persona.ambientSound)) {
      return `Field 'ambientSound' must be one of: ${VALID_AMBIENT_SOUNDS.join(", ")}`;
    }
  }
  if (persona.silenceTimeout != null) {
    if (typeof persona.silenceTimeout !== "number" || persona.silenceTimeout < 5 || persona.silenceTimeout > 120) {
      return "Field 'silenceTimeout' must be a number between 5 and 120";
    }
  }
  if (persona.temperature != null) {
    if (typeof persona.temperature !== "number" || persona.temperature < 0.0 || persona.temperature > 2.0) {
      return "Field 'temperature' must be a number between 0.0 and 2.0";
    }
  }

  const optionalStrings = ["description", "avatar", "initialGreeting", "phoneNumber", "bgColor", "borderColor"];
  for (const field of optionalStrings) {
    if (persona[field] != null && typeof persona[field] !== "string") {
      return `Field '${field}' must be a string`;
    }
  }

  // Validate enabledTools (optional array of tool name strings)
  if (persona.enabledTools != null) {
    if (!Array.isArray(persona.enabledTools)) {
      return "Field 'enabledTools' must be an array of strings";
    }
    if (persona.enabledTools.length > 50) {
      return "Field 'enabledTools' must have at most 50 entries";
    }
    for (const tool of persona.enabledTools) {
      if (typeof tool !== "string" || tool.length > 100) {
        return "Each entry in 'enabledTools' must be a string up to 100 characters";
      }
    }
  }

  return null;
}

// ─── Knowledge Base Validator ───────────────────────────────────

export function validateKnowledgeBase(kb: any): string | null {
  if (!kb || typeof kb !== "object") {
    return "Invalid knowledge base payload";
  }
  if (typeof kb.id !== "string" || !/^[a-zA-Z0-9-_]+$/.test(kb.id) || kb.id.length > 50) {
    return "Field 'id' must be alphanumeric (dashes/underscores allowed) and between 1 and 50 characters";
  }
  if (typeof kb.name !== "string" || kb.name.trim().length === 0 || kb.name.length > 100) {
    return "Field 'name' must be between 1 and 100 characters";
  }
  if (typeof kb.description !== "string" || kb.description.length > 500) {
    return "Field 'description' must be a string up to 500 characters";
  }
  if (!Array.isArray(kb.documents)) {
    return "Field 'documents' must be an array";
  }
  for (const doc of kb.documents) {
    if (typeof doc !== "object" || !doc) {
      return "Each document must be an object";
    }
    if (typeof doc.id !== "string" || doc.id.length > 50) {
      return "Each document must have a string 'id'";
    }
    if (typeof doc.title !== "string" || doc.title.trim().length === 0 || doc.title.length > 150) {
      return "Each document must have a string 'title' between 1 and 150 characters";
    }
    if (typeof doc.content !== "string" || doc.content.trim().length === 0 || doc.content.length > 20000) {
      return "Each document must have a string 'content' up to 20,000 characters";
    }
  }
  return null;
}
