import mongoose from "mongoose";
import { connectDatabase } from "../server/config.js";
import { CallLogModel } from "../server/models/CallLog.js";

async function main() {
  await connectDatabase();
  
  const call = await CallLogModel.findOne({ callId: "call_d7137a8db3f0" });
  console.log("=== CALL LOG ===");
  console.log(JSON.stringify(call, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
