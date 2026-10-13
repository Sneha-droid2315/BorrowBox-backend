import mongoose from 'mongoose';
import { env } from './env';

let memoryServer: any = null;
let connectionPromise: Promise<typeof mongoose> | null = null;

const createMemoryServer = async (): Promise<any> => {
  const pkgName = 'mongodb-memory-server';
  const mod = await import(pkgName);
  return mod.MongoMemoryServer.create();
};

export const connectDB = async (uriOverride?: string): Promise<void> => {
  // Reuse active connection across requests
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Share in-flight connection attempt during concurrent requests
  if (connectionPromise && mongoose.connection.readyState === 2) {
    await connectionPromise;
    return;
  }

  let uri = (uriOverride || env.MONGODB_URI || '').trim();
  const isServerlessOrProd =
    env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) || Boolean(process.env.RENDER);

  const isPlaceholderUri =
    !uri ||
    uri.includes('<username>') ||
    uri.includes('example.mongodb.net');

  if (isPlaceholderUri) {
    if (isServerlessOrProd) {
      throw new Error(
        'MONGODB_URI environment variable is missing or invalid. Please configure your MongoDB Atlas URI in Environment Variables.'
      );
    }

    // Local development fallback only
    if (!memoryServer) {
      memoryServer = await createMemoryServer();
      uri = memoryServer.getUri();
      console.log(
        '[MongoDB] No external MongoDB configured; using in-memory MongoDB for local development.'
      );
    } else {
      uri = memoryServer.getUri();
    }
  }

  try {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      family: 4,
    });
    const conn = await connectionPromise;
    if (env.NODE_ENV !== 'test') {
      console.log(`[MongoDB] Connected: ${conn.connection.host} (${conn.connection.name})`);
    }
  } catch (error) {
    connectionPromise = null;
    if (
      !isServerlessOrProd &&
      (uri.includes('127.0.0.1:27017') || uri.includes('localhost:27017'))
    ) {
      if (!memoryServer) {
        memoryServer = await createMemoryServer();
      }
      const fallbackUri = memoryServer.getUri();
      connectionPromise = mongoose.connect(fallbackUri);
      await connectionPromise;
      console.log('[MongoDB] Local mongod unreachable; connected to in-memory MongoDB for development.');
      return;
    }

    console.error('[MongoDB] Connection error:', error);
    throw error;
  }
};

if (!process.env.VERCEL) {
  process.on('SIGINT', async () => {
    if (memoryServer) {
      await memoryServer.stop();
    }
    process.exit(0);
  });
}
