import app from './app';
import { connectDB } from './config/db';
import { env, isCloudinaryConfigured } from './config/env';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    if (!isCloudinaryConfigured) {
      console.log(
        '[Storage] Cloudinary credentials not set — using local development fallback (/uploads).'
      );
    } else {
      console.log('[Storage] Cloudinary image storage configured.');
    }

    app.listen(env.PORT, () => {
      console.log(`[BorrowBox Server] Running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (error) {
    console.error('[BorrowBox Server] Failed to start:', error);
    process.exit(1);
  }
};

startServer();
