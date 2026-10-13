import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { AppError } from '../utils/AppError';

export interface AuthRequest extends Request {
  user?: IUser;
}

interface JwtPayload {
  userId: string;
  role: 'student' | 'admin';
}

export const extractToken = (req: Request): string | null => {
  if (req.cookies && req.cookies.borrowbox_token) {
    return req.cookies.borrowbox_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

export const requireAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError('User belonging to this session no longer exists.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been suspended by an administrator.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch {
    next();
  }
};

export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Access denied. Administrator privileges required.', 403));
  }
  next();
};
