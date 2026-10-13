import app from './app';
import { connectDB } from './config/db';
import { env, isCloudinaryConfigured } from './config/env';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    if (!isCloudinaryConfigured) {
      console.log(
        '[Storage] Cloudinary credentials not set — using fallback image handling.'
      );
    } else {
      console.log('[Storage] Cloudinary image storage configured.');
    }

    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[BorrowBox Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (error) {
    console.error('[BorrowBox Server] Failed to start:', error);
    process.exit(1);
  }
};

// Start HTTP listener when running on Render or localhost (skip only on Vercel Serverless / test)
if (!process.env.VERCEL && env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
