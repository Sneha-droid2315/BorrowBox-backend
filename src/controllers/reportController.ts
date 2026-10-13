import { Response } from 'express';
import { z } from 'zod';
import { Report } from '../models/Report';
import { Item } from '../models/Item';
import { User } from '../models/User';
import { REPORT_REASONS } from '../utils/constants';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';

const createReportSchema = z.object({
  targetType: z.enum(['item', 'user']),
  targetItemId: z.string().optional(),
  targetUserId: z.string().optional(),
  reason: z.enum(REPORT_REASONS, {
    errorMap: () => ({ message: 'Please select a valid report reason' }),
  }),
  description: z
    .string()
    .trim()
    .min(10, 'Please provide at least 10 characters of detail')
    .max(1000, 'Description cannot exceed 1000 characters'),
});

export const createReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const validated = createReportSchema.parse(req.body);

  let targetItem = undefined;
  let targetUser = undefined;

  if (validated.targetType === 'item') {
    if (!validated.targetItemId) {
      throw new AppError('Target item ID is required when reporting an item.', 400);
    }
    const item = await Item.findById(validated.targetItemId);
    if (!item) {
      throw new AppError('Reported item was not found.', 404);
    }
    if (item.owner.toString() === req.user._id.toString()) {
      throw new AppError('You cannot report your own item.', 400);
    }
    targetItem = item._id;
    targetUser = item.owner;
  } else {
    if (!validated.targetUserId) {
      throw new AppError('Target user ID is required when reporting a user.', 400);
    }
    if (validated.targetUserId === req.user._id.toString()) {
      throw new AppError('You cannot report your own profile.', 400);
    }
    const user = await User.findById(validated.targetUserId);
    if (!user) {
      throw new AppError('Reported user was not found.', 404);
    }
    targetUser = user._id;
  }

  const report = await Report.create({
    reporter: req.user._id,
    targetType: validated.targetType,
    targetItem,
    targetUser,
    reason: validated.reason,
    description: validated.description,
    status: 'Pending',
  });

  res.status(201).json({
    success: true,
    message: 'Report submitted to campus administrators for review.',
    report,
  });
});

export const getMyReports = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const reports = await Report.find({ reporter: req.user._id })
    .populate('targetItem', 'title category')
    .populate('targetUser', 'name email department')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    reports,
  });
});
