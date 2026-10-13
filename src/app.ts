import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';
import { env, isCloudinaryConfigured } from './config/env';
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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Serve locally uploaded images when Cloudinary fallback is active
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

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
    storageMode: isCloudinaryConfigured ? 'cloudinary' : 'local-fallback',
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
