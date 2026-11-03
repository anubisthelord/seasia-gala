import mongoose from "mongoose";
import dotenv from "dotenv";

// 1. Load .env.local explicitly for standalone scripts (like your admin creator)
// Next.js normally does this automatically, but standalone scripts (via tsx) do not.
dotenv.config({ path: ".env.local" });

// 2. We assert it's a string using `as string` to fix the TS error.
// We can safely do this because we check it immediately below.
const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in your .env.local file");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // 3. MONGODB_URI is now strictly typed as a string, so TS is happy.
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}