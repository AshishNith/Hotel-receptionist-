import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/VOiceAgent";

// Inline models definition to avoid import path issues
const PersonaSchema = new mongoose.Schema({
  id: String,
  name: String,
  role: String,
  description: String,
  voice: String,
  systemInstruction: String,
  accentColor: String,
  bgColor: String,
  borderColor: String,
  avatar: String,
  initialGreeting: String,
  phoneNumber: String,
  knowledgeBaseId: String,
  ambientSound: String,
  silenceTimeout: Number,
  temperature: Number,
  isDefault: Boolean,
});

const KnowledgeBaseSchema = new mongoose.Schema({
  id: String,
  name: String,
  description: String,
  documents: [{
    id: String,
    title: String,
    content: String,
  }],
});

const GoogleTokenSchema = new mongoose.Schema({
  phoneKey: String,
  access_token: String,
  refresh_token: String,
  expiry_date: Number,
  scope: String,
  token_type: String,
});

const CallLogSchema = new mongoose.Schema({
  callId: String,
  direction: String,
  callerNumber: String,
  receiverNumber: String,
  startTime: Date,
  endTime: Date,
  durationSeconds: Number,
  status: String,
  personaId: String,
  recordingUrl: String,
  transcript: [{
    sender: String,
    text: String,
    timestamp: Date,
  }],
});

const Persona = mongoose.models.Persona || mongoose.model("Persona", PersonaSchema);
const KnowledgeBase = mongoose.models.KnowledgeBase || mongoose.model("KnowledgeBase", KnowledgeBaseSchema);
const GoogleToken = mongoose.models.GoogleToken || mongoose.model("GoogleToken", GoogleTokenSchema);
const CallLog = mongoose.models.CallLog || mongoose.model("CallLog", CallLogSchema);

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB at " + MONGODB_URI);

    const personas = await Persona.find({}).lean();
    const kbs = await KnowledgeBase.find({}).lean();
    const tokens = await GoogleToken.find({}).lean();
    const calls = await CallLog.find({}).lean();

    const output = {
      personas: personas.map((p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        voice: p.voice,
        isDefault: p.isDefault,
        knowledgeBaseId: p.knowledgeBaseId || null
      })),
      knowledgeBases: kbs.map((k: any) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        documentCount: k.documents?.length || 0,
        documents: k.documents?.map((d: any) => d.title) || []
      })),
      googleTokens: tokens.map((t: any) => ({
        phoneKey: t.phoneKey,
        hasAccessToken: !!t.access_token,
        hasRefreshToken: !!t.refresh_token,
        expiryDate: t.expiry_date ? new Date(t.expiry_date).toISOString() : null
      })),
      callsSummary: {
        totalCalls: calls.length,
        inboundCount: calls.filter((c: any) => c.direction === "inbound").length,
        outboundCount: calls.filter((c: any) => c.direction === "outbound").length,
        recentCalls: calls.slice(-5).map((c: any) => ({
          callId: c.callId,
          direction: c.direction,
          caller: c.callerNumber,
          receiver: c.receiverNumber,
          duration: c.durationSeconds,
          status: c.status,
          personaId: c.personaId
        }))
      }
    };

    console.log("===DB_SUMMARY_START===");
    console.log(JSON.stringify(output, null, 2));
    console.log("===DB_SUMMARY_END===");
  } catch (err: any) {
    console.error("Error fetching db summary:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
