import { Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { Item } from '../models/Item';
import { BorrowRequest } from '../models/BorrowRequest';
import { Report } from '../models/Report';
import { Notification } from '../models/Notification';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';

const updateReportSchema = z.object({
  status: z.enum(['Resolved', 'Dismissed']),
  adminNotes: z.string().trim().max(1000).optional().default(''),
  disableTargetItem: z.boolean().optional().default(false),
});

export const getAdminDashboardStats = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const now = new Date();

    const [
      totalUsers,
      studentCount,
      adminCount,
      suspendedUsersCount,
      totalListings,
      availableListings,
      reservedListings,
      borrowedListings,
      unavailableListings,
      pendingRequestsCount,
      activeBorrowingsCount,
      overdueTransactions,
      completedReturnsCount,
      pendingReportsCount,
      resolvedReportsCount,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ isActive: false }),
      Item.countDocuments(),
      Item.countDocuments({ status: 'Available' }),
      Item.countDocuments({ status: 'Reserved' }),
      Item.countDocuments({ status: 'Borrowed' }),
      Item.countDocuments({ status: 'Unavailable' }),
      BorrowRequest.countDocuments({ status: 'Pending' }),
      BorrowRequest.countDocuments({ status: 'Borrowed' }),
      BorrowRequest.find({
        status: 'Borrowed',
        expectedReturnDate: { $lt: now },
      })
        .populate('item', 'title category pickupLocation')
        .populate('borrower', 'name email department year phone')
        .populate('owner', 'name email department year phone')
        .sort({ expectedReturnDate: 1 }),
      BorrowRequest.countDocuments({ status: 'Returned' }),
      Report.countDocuments({ status: 'Pending' }),
      Report.countDocuments({ status: 'Resolved' }),
      BorrowRequest.find()
        .populate('item', 'title category status')
        .populate('borrower', 'name email department')
        .populate('owner', 'name email department')
        .sort({ updatedAt: -1 })
        .limit(8),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        studentCount,
        adminCount,
        suspendedUsersCount,
        totalListings,
        availableListings,
        reservedListings,
        borrowedListings,
        unavailableListings,
        pendingRequestsCount,
        activeBorrowingsCount,
        overdueCount: overdueTransactions.length,
        completedReturnsCount,
        pendingReportsCount,
        resolvedReportsCount,
      },
      overdueTransactions,
      recentTransactions,
    });
  }
);

export const getAdminUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';

  const filter: Record<string, any> = {};
  if (search) {
    const safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: safeRegex }, { email: safeRegex }, { department: safeRegex }];
  }
  if (role && ['student', 'admin'].includes(role)) {
    filter.role = role;
  }

  const users = await User.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    users,
  });
});

export const toggleUserStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    throw new AppError('User not found.', 404);
  }

  if (targetUser._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot suspend your own administrator account.', 400);
  }

  targetUser.isActive = !targetUser.isActive;
  await targetUser.save();

  res.status(200).json({
    success: true,
    message: `User account ${targetUser.isActive ? 'activated' : 'suspended'} successfully.`,
    user: targetUser.toJSON(),
  });
});

export const getAdminItems = asyncHandler(async (req: AuthRequest, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

  const filter: Record<string, any> = {};
  if (search) {
    const safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: safeRegex }, { category: safeRegex }, { pickupLocation: safeRegex }];
  }
  if (status && status !== 'All') {
    filter.status = status;
  }

  const items = await Item.find(filter)
    .populate('owner', 'name email department year reputation')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    items,
  });
});

export const getAdminReports = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const filter: Record<string, any> = {};
  if (status && status !== 'All') {
    filter.status = status;
  }

  const reports = await Report.find(filter)
    .populate('reporter', 'name email department year')
    .populate('targetItem', 'title category status isOwnerDisabled')
    .populate('targetUser', 'name email department year isActive')
    .populate('resolvedBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    reports,
  });
});

export const updateReportStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const validated = updateReportSchema.parse(req.body);
  const report = await Report.findById(req.params.id);

  if (!report) {
    throw new AppError('Report not found.', 404);
  }

  report.status = validated.status;
  report.adminNotes = validated.adminNotes;
  report.resolvedBy = req.user._id;
  report.resolvedAt = new Date();
  await report.save();

  if (validated.disableTargetItem && report.targetItem) {
    const item = await Item.findById(report.targetItem);
    if (item && item.status === 'Available') {
      item.status = 'Unavailable';
      item.isOwnerDisabled = true;
      await item.save();
    }
  }

  await Notification.create({
    recipient: report.reporter,
    sender: req.user._id,
    type: 'SYSTEM',
    title: `Report ${validated.status}`,
    message: `Your report (${report.reason}) has been marked as ${validated.status} by a campus administrator.${
      validated.adminNotes ? ` Note: ${validated.adminNotes}` : ''
    }`,
    relatedItem: report.targetItem,
  });

  const populated = await Report.findById(report._id)
    .populate('reporter', 'name email department year')
    .populate('targetItem', 'title category status isOwnerDisabled')
    .populate('targetUser', 'name email department year isActive')
    .populate('resolvedBy', 'name email');

  res.status(200).json({
    success: true,
    message: `Report marked as ${validated.status}.`,
    report: populated,
  });
});
