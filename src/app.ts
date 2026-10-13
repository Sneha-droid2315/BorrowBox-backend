import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';
import { env, isCloudinaryConfigured } from './config/env';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import itemRoutes from './routes/itemRoutes';
import borrowRoutes from './routes/borrowRoutes';
import wishlistRoutes from './routes/wishlistRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reviewRoutes from './routes/reviewRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware';

const app = express();

// Trust reverse proxy (required for Vercel / Render rate limiting and secure cookies)
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = env.CLIENT_ORIGIN.split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        allowedOrigins.includes('*')
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Serve locally uploaded images when running local development fallback
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Root welcome route (helpful when visiting the Vercel backend URL directly)
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'BorrowBox API',
    status: 'ok',
    healthEndpoint: '/api/health',
  });
});

// Ensure MongoDB connection is established before handling API routes (serverless-safe)
app.use('/api', async (_req, _res, next) => {
  if (env.NODE_ENV === 'test') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const dbStates: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    service: 'BorrowBox API',
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    storageMode: isCloudinaryConfigured
      ? 'cloudinary'
      : process.env.VERCEL
      ? 'inline-fallback'
      : 'local-fallback',
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/requests', borrowRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
