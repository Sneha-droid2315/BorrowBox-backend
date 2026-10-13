import { Response } from 'express';
import { Notification } from '../models/Notification';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';

export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id })
      .populate('sender', 'name department')
      .populate('relatedItem', 'title category images')
      .sort({ createdAt: -1 })
      .limit(50),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  res.status(200).json({
    success: true,
    notifications,
    unreadCount,
  });
});

export const markNotificationRead = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found.', 404);
    }

    res.status(200).json({
      success: true,
      notification,
    });
  }
);

export const markAllNotificationsRead = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  }
);

export const deleteNotification = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!deleted) {
      throw new AppError('Notification not found.', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted.',
    });
  }
);
