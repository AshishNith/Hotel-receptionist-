import mongoose from "mongoose";

const sourceUri = "mongodb://127.0.0.1:27017/VOiceAgent";
// We URL-encode the '%' in password to avoid malformed URI errors
const targetUri = "mongodb+srv://gorandotin_db_user:rH8gX79_%25gBt2!K@cluster0.od0vs9l.mongodb.net/VoiceAgent?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  console.log("Connecting to Source DB:", sourceUri);
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  console.log("Connected to Source DB successfully.");

  console.log("Connecting to Target DB:", targetUri);
  const targetConn = await mongoose.createConnection(targetUri).asPromise();
  console.log("Connected to Target DB successfully.");

  const collections = ["personas", "knowledgebases", "calllogs", "googletokens"];

  for (const collName of collections) {
    console.log(`\nMigrating collection: ${collName}...`);
    const sourceColl = sourceConn.collection(collName);
    const targetColl = targetConn.collection(collName);

    const docs = await sourceColl.find({}).toArray();
    console.log(`Found ${docs.length} documents in source ${collName}.`);

    if (docs.length === 0) continue;

    let successCount = 0;
    for (const doc of docs) {
      try {
        // Upsert by _id to avoid duplicates
        await targetColl.updateOne(
          { _id: doc._id },
          { $set: doc },
          { upsert: true }
        );
        successCount++;
      } catch (err: any) {
        console.error(`Error migrating doc ${doc._id} in ${collName}:`, err.message);
      }
    }
    console.log(`Successfully migrated ${successCount}/${docs.length} documents in ${collName}.`);
  }

  await sourceConn.close();
  await targetConn.close();
  console.log("\nMigration completed successfully!");
}

run().catch(console.error);
