import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL;

if (!url) {
  throw new Error(
    "MONGODB_URL is not set. Add it to your .env file or deployment environment variables.",
  );
}

export const client = new MongoClient(url);

export const db = client.db();
