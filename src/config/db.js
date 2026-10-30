const dns = require("dns");

// Some networks block SRV lookups for Atlas, so use public DNS servers
if (!process.env.VERCEL) dns.setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient } = require("mongodb");

let client;
let db;
let indexesReady = false;

async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.DB_NAME || "booknook");

  if (!indexesReady) {
    // One active borrow per user per book (stops double borrow, even on race)
    await db
      .collection("borrows")
      .createIndex({ bookId: 1, userEmail: 1 }, { unique: true });
    await db.collection("books").createIndex({ createdAt: -1 });
    indexesReady = true;
  }
  return db;
}

module.exports = { getDb };