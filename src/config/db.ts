import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env';

let memoryServer: MongoMemoryServer | null = null;

export const connectDB = async (uriOverride?: string): Promise<void> => {
  let uri = uriOverride || env.MONGODB_URI;

  if (
    !uri ||
    uri.includes('<username>') ||
    uri.includes('example.mongodb.net') ||
    uri.includes('127.0.0.1:27017') ||
    uri.includes('localhost:27017')
  ) {
    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      console.log('[MongoDB] No external MongoDB configured; using in-memory MongoDB for development.');
    } else {
      uri = memoryServer.getUri();
    }
  }

  try {
    const conn = await mongoose.connect(uri);
    if (env.NODE_ENV !== 'test') {
      console.log(`[MongoDB] Connected: ${conn.connection.host} (${conn.connection.name})`);
    }
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    throw error;
  }
};

process.on('SIGINT', async () => {
  if (memoryServer) {
    await memoryServer.stop();
  }
  process.exit(0);
});
