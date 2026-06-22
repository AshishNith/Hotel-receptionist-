import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

const Schema = mongoose.Schema;
const PersonaSchema = new Schema({}, { strict: false });
const PersonaModel = mongoose.model("Persona", PersonaSchema, "personas");

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in env");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const diya = await PersonaModel.findOne({ id: "diya" });
  console.log("Diya Persona:", JSON.stringify(diya, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
