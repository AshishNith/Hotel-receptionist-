import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

const Schema = mongoose.Schema;
const PersonaSchema = new Schema({
  id: String,
  name: String,
  role: String,
  description: String,
  voice: String,
  systemInstruction: String,
  initialGreeting: String,
  isDefault: Boolean,
});

const PersonaModel = mongoose.model("Persona", PersonaSchema);

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in env");
    process.exit(1);
  }
  console.log("Connecting to:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected! Fetching personas...");
  const personas = await PersonaModel.find({});
  console.log("Personas count:", personas.length);
  for (const p of personas) {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Role: ${p.role}`);
  }
  await mongoose.disconnect();
}

run().catch(console.error);
