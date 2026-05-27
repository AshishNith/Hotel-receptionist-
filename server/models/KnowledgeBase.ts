import { Schema, model } from "mongoose";

export interface IDocument {
  id: string;
  title: string;
  content: string;
}

export interface IKnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: IDocument[];
}

const DocumentSchema = new Schema<IDocument>({
  id:      { type: String, required: true },
  title:   { type: String, required: true },
  content: { type: String, required: true },
});

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>({
  id:          { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  description: { type: String, default: "" },
  documents:   { type: [DocumentSchema], default: [] },
});

export const KnowledgeBaseModel = model<IKnowledgeBase>("KnowledgeBase", KnowledgeBaseSchema);
