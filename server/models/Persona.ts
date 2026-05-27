import { Schema, model } from "mongoose";

export interface IPersona {
  id: string;
  name: string;
  role: string;
  description?: string;
  voice: string;
  systemInstruction: string;
  accentColor: string;
  bgColor?: string;
  borderColor?: string;
  avatar?: string;
  initialGreeting?: string;
  phoneNumber?: string;
  knowledgeBaseId?: string;
  ambientSound?: string;
  silenceTimeout?: number;
  temperature?: number;
  isDefault?: boolean;
}

const PersonaSchema = new Schema<IPersona>({
  id:                { type: String, required: true, unique: true },
  name:              { type: String, required: true },
  role:              { type: String, required: true },
  description:       { type: String },
  voice:             { type: String, required: true },
  systemInstruction: { type: String, required: true },
  accentColor:       { type: String, required: true },
  bgColor:           { type: String },
  borderColor:       { type: String },
  avatar:            { type: String },
  initialGreeting:   { type: String },
  phoneNumber:       { type: String },
  knowledgeBaseId:   { type: String },
  ambientSound:      { type: String, default: "none" },
  silenceTimeout:    { type: Number, default: 30 },
  temperature:       { type: Number, default: 0.7 },
  isDefault:         { type: Boolean, default: false },
});

export const PersonaModel = model<IPersona>("Persona", PersonaSchema);
