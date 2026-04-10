import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || 'merque_bienestar';

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  if (client) return client;

  if (!connecting) {
    connecting = new MongoClient(MONGODB_URI).connect().then((c) => {
      client = c;
      connecting = null;
      return c;
    }).catch((err) => {
      connecting = null;
      throw err;
    });
  }

  return connecting;
}

export async function getDb(): Promise<Db> {
  const c = await getClient();
  return c.db(DB_NAME);
}
