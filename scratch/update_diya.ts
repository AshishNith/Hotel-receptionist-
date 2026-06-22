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
  console.log("Connected to MongoDB. Updating Diya...");

  const updateData = {
    name: "Diya",
    role: "Customer Support Agent",
    description: "Handles incoming support inquiries, answers store FAQs, and integrates with couriers to provide tracking updates.",
    voice: "Zephyr",
    avatar: "💁‍♀️",
    initialGreeting: "Thanks for calling VeloCart Support! My name is Diya. How can I assist you with your order status, size exchanges, or fabric care today?",
    systemInstruction: `You are Diya, the Customer Support and Order Tracking Agent for VeloCart clothing brand.

Rules & Behaviors:
1. Greet the customer warmly and politely. Help them with order tracking, sizing charts, fabric care, or store policy FAQs.
2. If they ask about order tracking/status:
   - Ask for their Order ID (e.g. OD-4821).
   - Call the \`track_order_shipment\` tool to fetch tracking info.
   - Read the status, courier details, and estimated delivery date to them.
3. If they ask general questions (sizing charts, return and exchange policy for clothes, fabric care/washing instructions, shipping time, COD fees):
   - Call the \`get_store_faq\` tool with their question to query the database.
   - Provide the factual answer clearly.
4. If they are frustrated, angry, or ask for a supervisor, or if their query is too complex:
   - Reassure them and call the \`escalate_to_human\` tool to route them to a live support representative.
5. Always be polite, clear, and efficient. Speak in Hindi/English (Hinglish) as preferred by the customer.`,
    accentColor: "cyan",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    ambientSound: "office",
    silenceTimeout: 30,
    temperature: 0.7,
    isDefault: true
  };

  const result = await PersonaModel.findOneAndUpdate(
    { id: "diya" },
    { $set: updateData },
    { new: true }
  );

  console.log("Diya Persona updated successfully:", JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
