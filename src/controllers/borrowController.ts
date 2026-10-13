import { Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { BorrowRequest } from '../models/BorrowRequest';
import { Item } from '../models/Item';
import { Notification } from '../models/Notification';
import { Wishlist } from '../models/Wishlist';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';
import { syncUserReputation } from '../utils/reputation';

const createBorrowRequestSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  message: z
    .string()
    .trim()
    .min(5, 'Please write a brief message (at least 5 characters) explaining your need')
    .max(1000, 'Message cannot exceed 1000 characters'),
  pickupDate: z.string().min(1, 'Pickup date is required'),
  expectedReturnDate: z.string().min(1, 'Expected return date is required'),
});

const respondRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
  note: z.string().trim().max(500).optional(),
});

const handoverSchema = z.object({
  handoverCode: z.string().trim().optional(),
});

const returnSchema = z.object({
  returnConditionNote: z.string().trim().max(500).optional(),
});

export const createBorrowRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const validated = createBorrowRequestSchema.parse(req.body);

    const item = await Item.findById(validated.itemId).populate('owner', 'name email');
    if (!item) {
      throw new AppError('Item not found.', 404);
    }

    if (item.owner._id.toString() === req.user._id.toString()) {
      throw new AppError('You cannot request to borrow your own item.', 400);
    }

    if (item.status !== 'Available' || item.isOwnerDisabled) {
      throw new AppError(
        `This item is currently ${item.status.toLowerCase()} and cannot be requested.`,
        400
      );
    }

    const pickup = new Date(validated.pickupDate);
    const expectedReturn = new Date(validated.expectedReturnDate);

    if (isNaN(pickup.getTime()) || isNaN(expectedReturn.getTime())) {
      throw new AppError('Invalid pickup or return date format.', 400);
    }

    // Compare against start of today (UTC/local tolerant)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const pickupDay = new Date(pickup);
    pickupDay.setHours(23, 59, 59, 999);

    if (pickupDay.getTime() < todayStart.getTime()) {
      throw new AppError('Pickup date cannot be in the past.', 400);
    }

    if (expectedReturn.getTime() < pickup.getTime()) {
      throw new AppError('Expected return date must be on or after the pickup date.', 400);
    }

    const diffDays = Math.ceil(
      (expectedReturn.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > item.maxBorrowDays) {
      throw new AppError(
        `Borrow duration (${diffDays} days) exceeds the owner's maximum limit of ${item.maxBorrowDays} days.`,
        400
      );
    }

    // Prevent duplicate active or pending requests from the same student
    const existingUserRequest = await BorrowRequest.findOne({
      item: item._id,
      borrower: req.user._id,
      status: { $in: ['Pending', 'Accepted', 'Borrowed'] },
    });

    if (existingUserRequest) {
      throw new AppError(
        `You already have an active (${existingUserRequest.status}) request for this item.`,
        409
      );
    }

    // Prevent conflicting active bookings on the item
    const conflictingBooking = await BorrowRequest.findOne({
      item: item._id,
      status: { $in: ['Accepted', 'Borrowed'] },
    });

    if (conflictingBooking) {
      throw new AppError('This item is already reserved or borrowed by another student.', 409);
    }

    const borrowRequest = await BorrowRequest.create({
      item: item._id,
      borrower: req.user._id,
      owner: item.owner._id,
      message: validated.message,
      pickupDate: pickup,
      expectedReturnDate: expectedReturn,
      status: 'Pending',
    });

    await Notification.create({
      recipient: item.owner._id,
      sender: req.user._id,
      type: 'REQUEST_RECEIVED',
      title: 'New Borrow Request',
      message: `${req.user.name} requested to borrow "${item.title}".`,
      relatedItem: item._id,
      relatedRequest: borrowRequest._id,
    });

    const populated = await BorrowRequest.findById(borrowRequest._id)
      .populate('item', 'title category condition images pickupLocation status')
      .populate('borrower', 'name email department year phone reputation')
      .populate('owner', 'name email department year phone reputation');

    res.status(201).json({
      success: true,
      message: 'Borrow request submitted! The owner has been notified.',
      request: populated,
    });
  }
);

export const respondToBorrowRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { action, note } = respondRequestSchema.parse(req.body);
    const borrowRequest = await BorrowRequest.findById(req.params.id).populate('item');

    if (!borrowRequest) {
      throw new AppError('Borrow request not found.', 404);
    }

    if (borrowRequest.owner.toString() !== req.user._id.toString()) {
      throw new AppError('Only the item owner can accept or reject this request.', 403);
    }

    if (borrowRequest.status !== 'Pending') {
      throw new AppError(
        `Cannot ${action} a request that is currently in "${borrowRequest.status}" status.`,
        400
      );
    }

    const item = await Item.findById(borrowRequest.item._id);
    if (!item) {
      throw new AppError('Associated item no longer exists.', 404);
    }

    if (action === 'accept') {
      if (item.status !== 'Available') {
        throw new AppError(
          `Item is currently "${item.status}" and cannot be reserved for this request.`,
          409
        );
      }

      const conflictingBooking = await BorrowRequest.findOne({
        item: item._id,
        _id: { $ne: borrowRequest._id },
        status: { $in: ['Accepted', 'Borrowed'] },
      });

      if (conflictingBooking) {
        throw new AppError('Another request is already active for this item.', 409);
      }

      const handoverCode = `BB-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      borrowRequest.status = 'Accepted';
      borrowRequest.acceptedAt = new Date();
      borrowRequest.handoverCode = handoverCode;
      if (note) borrowRequest.ownerResponseNote = note;
      await borrowRequest.save();

      item.status = 'Reserved';
      await item.save();

      // Automatically decline other competing pending requests for this item
      const competingRequests = await BorrowRequest.find({
        item: item._id,
        _id: { $ne: borrowRequest._id },
        status: 'Pending',
      });

      if (competingRequests.length > 0) {
        await BorrowRequest.updateMany(
          {
            item: item._id,
            _id: { $ne: borrowRequest._id },
            status: 'Pending',
          },
          {
            $set: {
              status: 'Rejected',
              rejectedAt: new Date(),
              ownerResponseNote: 'Item was reserved for another student request.',
            },
          }
        );

        await Notification.insertMany(
          competingRequests.map((comp) => ({
            recipient: comp.borrower,
            sender: req.user!._id,
            type: 'REQUEST_REJECTED' as const,
            title: 'Borrow Request Update',
            message: `Your request for "${item.title}" was declined because another request was accepted.`,
            relatedItem: item._id,
            relatedRequest: comp._id,
          }))
        );
      }

      await Notification.create({
        recipient: borrowRequest.borrower,
        sender: req.user._id,
        type: 'REQUEST_ACCEPTED',
        title: 'Borrow Request Accepted!',
        message: `${req.user.name} accepted your request for "${item.title}". Pickup location: ${item.pickupLocation}. Handover code: ${handoverCode}`,
        relatedItem: item._id,
        relatedRequest: borrowRequest._id,
      });
    } else {
      borrowRequest.status = 'Rejected';
      borrowRequest.rejectedAt = new Date();
      if (note) borrowRequest.ownerResponseNote = note;
      await borrowRequest.save();

      await Notification.create({
        recipient: borrowRequest.borrower,
        sender: req.user._id,
        type: 'REQUEST_REJECTED',
        title: 'Borrow Request Declined',
        message: `${req.user.name} declined your request for "${item.title}".${note ? ` Note: ${note}` : ''}`,
        relatedItem: item._id,
        relatedRequest: borrowRequest._id,
      });
    }

    const updated = await BorrowRequest.findById(borrowRequest._id)
      .populate('item', 'title category condition images pickupLocation status')
      .populate('borrower', 'name email department year phone reputation')
      .populate('owner', 'name email department year phone reputation');

    res.status(200).json({
      success: true,
      message:
        action === 'accept'
          ? 'Request accepted! The item is now reserved for handover.'
          : 'Request rejected.',
      request: updated,
    });
  }
);

export const confirmHandover = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const { handoverCode } = handoverSchema.parse(req.body || {});
  const borrowRequest = await BorrowRequest.findById(req.params.id);

  if (!borrowRequest) {
    throw new AppError('Borrow request not found.', 404);
  }

  if (borrowRequest.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Only the item owner can confirm handover.', 403);
  }

  if (borrowRequest.status !== 'Accepted') {
    throw new AppError(
      `Handover can only be confirmed for "Accepted" requests. Current status: "${borrowRequest.status}".`,
      400
    );
  }

  if (
    handoverCode &&
    borrowRequest.handoverCode &&
    handoverCode.toUpperCase() !== borrowRequest.handoverCode.toUpperCase()
  ) {
    throw new AppError('Invalid handover verification code.', 400);
  }

  const item = await Item.findById(borrowRequest.item);
  if (!item) {
    throw new AppError('Item not found.', 404);
  }

  borrowRequest.status = 'Borrowed';
  borrowRequest.handoverConfirmedAt = new Date();
  await borrowRequest.save();

  item.status = 'Borrowed';
  await item.save();

  await Notification.create({
    recipient: borrowRequest.borrower,
    sender: req.user._id,
    type: 'ITEM_HANDOVER',
    title: 'Handover Confirmed — Item Borrowed',
    message: `Handover confirmed for "${item.title}". Please return it by ${new Date(
      borrowRequest.expectedReturnDate
    ).toLocaleDateString()}.`,
    relatedItem: item._id,
    relatedRequest: borrowRequest._id,
  });

  const updated = await BorrowRequest.findById(borrowRequest._id)
    .populate('item', 'title category condition images pickupLocation status')
    .populate('borrower', 'name email department year phone reputation')
    .populate('owner', 'name email department year phone reputation');

  res.status(200).json({
    success: true,
    message: 'Handover confirmed! The item is now marked as Borrowed.',
    request: updated,
  });
});

export const confirmReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const { returnConditionNote } = returnSchema.parse(req.body || {});
  const borrowRequest = await BorrowRequest.findById(req.params.id);

  if (!borrowRequest) {
    throw new AppError('Borrow request not found.', 404);
  }

  if (
    borrowRequest.owner.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    throw new AppError('Only the item owner can confirm item return.', 403);
  }

  if (borrowRequest.status !== 'Borrowed') {
    throw new AppError(
      `Only currently "Borrowed" items can be marked as returned. Current status: "${borrowRequest.status}".`,
      400
    );
  }

  const item = await Item.findById(borrowRequest.item);
  if (!item) {
    throw new AppError('Item not found.', 404);
  }

  const now = new Date();
  const expectedEndOfDay = new Date(borrowRequest.expectedReturnDate);
  expectedEndOfDay.setHours(23, 59, 59, 999);

  borrowRequest.status = 'Returned';
  borrowRequest.returnedAt = now;
  borrowRequest.wasReturnedOnTime = now.getTime() <= expectedEndOfDay.getTime();
  if (returnConditionNote) {
    borrowRequest.returnConditionNote = returnConditionNote;
  }
  await borrowRequest.save();

  // Item becomes Available again unless owner has disabled the listing
  item.status = item.isOwnerDisabled ? 'Unavailable' : 'Available';
  await item.save();

  await Promise.all([
    syncUserReputation(borrowRequest.borrower),
    syncUserReputation(borrowRequest.owner),
    Notification.create({
      recipient: borrowRequest.borrower,
      sender: req.user._id,
      type: 'ITEM_RETURNED',
      title: 'Item Return Confirmed',
      message: `${req.user.name} confirmed the return of "${item.title}". You can now leave a review for this transaction!`,
      relatedItem: item._id,
      relatedRequest: borrowRequest._id,
    }),
  ]);

  const updated = await BorrowRequest.findById(borrowRequest._id)
    .populate('item', 'title category condition images pickupLocation status')
    .populate('borrower', 'name email department year phone reputation')
    .populate('owner', 'name email department year phone reputation');

  res.status(200).json({
    success: true,
    message: `Return completed! "${item.title}" is now ${item.status}.`,
    request: updated,
  });
});

export const cancelBorrowRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const borrowRequest = await BorrowRequest.findById(req.params.id);
    if (!borrowRequest) {
      throw new AppError('Borrow request not found.', 404);
    }

    if (borrowRequest.borrower.toString() !== req.user._id.toString()) {
      throw new AppError('Only the borrower who created this request can cancel it.', 403);
    }

    if (!['Pending', 'Accepted'].includes(borrowRequest.status)) {
      throw new AppError(
        `Cannot cancel a request in "${borrowRequest.status}" status.`,
        400
      );
    }

    const wasAccepted = borrowRequest.status === 'Accepted';
    borrowRequest.status = 'Cancelled';
    await borrowRequest.save();

    if (wasAccepted) {
      const item = await Item.findById(borrowRequest.item);
      if (item && item.status === 'Reserved') {
        item.status = item.isOwnerDisabled ? 'Unavailable' : 'Available';
        await item.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Borrow request cancelled.',
      request: borrowRequest,
    });
  }
);

export const getMyBorrowRequests = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const statusFilter =
      typeof req.query.status === 'string' && req.query.status !== 'All'
        ? { status: req.query.status }
        : {};

    const requests = await BorrowRequest.find({
      borrower: req.user._id,
      ...statusFilter,
    })
      .populate('item', 'title category condition images pickupLocation status')
      .populate('owner', 'name email department year phone reputation')
      .populate('borrower', 'name email department year phone reputation')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      requests,
    });
  }
);

export const getIncomingRequests = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const statusFilter =
      typeof req.query.status === 'string' && req.query.status !== 'All'
        ? { status: req.query.status }
        : {};

    const requests = await BorrowRequest.find({
      owner: req.user._id,
      ...statusFilter,
    })
      .populate('item', 'title category condition images pickupLocation status')
      .populate('borrower', 'name email department year phone reputation')
      .populate('owner', 'name email department year phone reputation')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      requests,
    });
  }
);

export const getStudentDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const userId = req.user._id;
    const now = new Date();

    const [
      myListingsCount,
      availableListingsCount,
      incomingPendingRequests,
      activeLendings,
      activeBorrowings,
      completedTransactionsCount,
      wishlistCount,
      unreadNotificationsCount,
      recentNotifications,
    ] = await Promise.all([
      Item.countDocuments({ owner: userId }),
      Item.countDocuments({ owner: userId, status: 'Available' }),
      BorrowRequest.find({ owner: userId, status: 'Pending' })
        .populate('item', 'title category images pickupLocation')
        .populate('borrower', 'name department year reputation')
        .sort({ createdAt: -1 })
        .limit(5),
      BorrowRequest.find({ owner: userId, status: { $in: ['Accepted', 'Borrowed'] } })
        .populate('item', 'title category images pickupLocation status')
        .populate('borrower', 'name email department year phone reputation')
        .sort({ expectedReturnDate: 1 }),
      BorrowRequest.find({
        borrower: userId,
        status: { $in: ['Pending', 'Accepted', 'Borrowed'] },
      })
        .populate('item', 'title category images pickupLocation status')
        .populate('owner', 'name email department year phone reputation')
        .sort({ expectedReturnDate: 1 }),
      BorrowRequest.countDocuments({
        $or: [{ borrower: userId }, { owner: userId }],
        status: 'Returned',
      }),
      Wishlist.countDocuments({ user: userId }),
      Notification.countDocuments({ recipient: userId, isRead: false }),
      Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const overdueBorrowingsCount = activeBorrowings.filter(
      (r) => r.status === 'Borrowed' && new Date(r.expectedReturnDate).getTime() < now.getTime()
    ).length;

    const overdueLendingsCount = activeLendings.filter(
      (r) => r.status === 'Borrowed' && new Date(r.expectedReturnDate).getTime() < now.getTime()
    ).length;

    res.status(200).json({
      success: true,
      stats: {
        myListingsCount,
        availableListingsCount,
        incomingPendingCount: incomingPendingRequests.length,
        activeLendingsCount: activeLendings.length,
        activeBorrowingsCount: activeBorrowings.length,
        overdueBorrowingsCount,
        overdueLendingsCount,
        completedTransactionsCount,
        wishlistCount,
        unreadNotificationsCount,
      },
      incomingPendingRequests,
      activeLendings,
      activeBorrowings,
      recentNotifications,
    });
  }
);
