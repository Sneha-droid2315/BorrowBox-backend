import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User, IUser } from '../models/User';
import { Item } from '../models/Item';
import { Review } from '../models/Review';
import { env } from '../config/env';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid college email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(72, 'Password cannot exceed 72 characters'),
  department: z.string().trim().min(2, 'Department is required').max(100),
  year: z.string().trim().min(2, 'Academic year is required').max(50),
  phone: z.string().trim().max(25).optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional().or(z.literal('')),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  department: z.string().trim().min(2, 'Department is required').max(100),
  year: z.string().trim().min(2, 'Academic year is required').max(50),
  phone: z.string().trim().max(25).optional().or(z.literal('')),
  bio: z.string().trim().max(500).optional().or(z.literal('')),
});

const signToken = (user: IUser): string => {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const setAuthCookie = (res: Response, token: string): void => {
  const isProd = env.NODE_ENV === 'production';
  res.cookie('borrowbox_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const validated = registerSchema.parse(req.body);

  const existingUser = await User.findOne({ email: validated.email });
  if (existingUser) {
    throw new AppError('An account with this email address already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(validated.password, 10);

  // Security: Explicitly set role to 'student'. Public admin registration is never allowed.
  const user = await User.create({
    name: validated.name,
    email: validated.email,
    passwordHash,
    role: 'student',
    department: validated.department,
    year: validated.year,
    phone: validated.phone || '',
    bio: validated.bio || '',
  });

  const token = signToken(user);
  setAuthCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Registration successful. Welcome to BorrowBox!',
    token,
    user: user.toJSON(),
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const validated = loginSchema.parse(req.body);

  const user = await User.findOne({ email: validated.email }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been suspended. Please contact campus administration.', 403);
  }

  const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = signToken(user);
  setAuthCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully.',
    token,
    user: user.toJSON(),
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  const isProd = env.NODE_ENV === 'production';
  res.clearCookie('borrowbox_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated.', 401);
  }
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  res.status(200).json({
    success: true,
    user: user.toJSON(),
  });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated.', 401);
  }

  const validated = updateProfileSchema.parse(req.body);

  if (validated.email !== req.user.email) {
    const emailTaken = await User.findOne({
      email: validated.email,
      _id: { $ne: req.user._id },
    });
    if (emailTaken) {
      throw new AppError('That email address is already in use by another account.', 409);
    }
  }

  // Mass-assignment protection: only allow updating safe profile fields
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        name: validated.name,
        email: validated.email,
        department: validated.department,
        year: validated.year,
        phone: validated.phone || '',
        bio: validated.bio || '',
      },
    },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new AppError('User not found.', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    user: updatedUser.toJSON(),
  });
});

export const getPublicUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select(
    'name department year bio reputation createdAt'
  );
  if (!user) {
    throw new AppError('Student profile not found.', 404);
  }

  const [listings, reviews] = await Promise.all([
    Item.find({ owner: user._id, isOwnerDisabled: false })
      .sort({ createdAt: -1 })
      .limit(12),
    Review.find({ reviewee: user._id })
      .populate('reviewer', 'name department year')
      .populate('item', 'title category')
      .sort({ createdAt: -1 })
      .limit(20),
  ]);

  res.status(200).json({
    success: true,
    profile: user,
    listings,
    reviews,
  });
});
