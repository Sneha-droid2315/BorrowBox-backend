import { Request, Response } from 'express';
import { z } from 'zod';
import { Review } from '../models/Review';
import { BorrowRequest } from '../models/BorrowRequest';
import { Notification } from '../models/Notification';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';
import { syncUserReputation } from '../utils/reputation';

const createReviewSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  comment: z.string().trim().max(1000, 'Comment cannot exceed 1000 characters').optional().default(''),
});

export const createReview = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const validated = createReviewSchema.parse(req.body);

  const transaction = await BorrowRequest.findById(validated.transactionId).populate(
    'item',
    'title'
  );
  if (!transaction) {
    throw new AppError('Transaction not found.', 404);
  }

  if (transaction.status !== 'Returned') {
    throw new AppError(
      'Reviews can only be submitted after the item has been marked as Returned.',
      400
    );
  }

  const userIdStr = req.user._id.toString();
  const isBorrower = transaction.borrower.toString() === userIdStr;
  const isOwner = transaction.owner.toString() === userIdStr;

  if (!isBorrower && !isOwner) {
    throw new AppError('Only participants of this transaction can leave a review.', 403);
  }

  if (isBorrower && transaction.borrowerReviewed) {
    throw new AppError('You have already submitted a review for this transaction.', 409);
  }

  if (isOwner && transaction.ownerReviewed) {
    throw new AppError('You have already submitted a review for this transaction.', 409);
  }

  const revieweeId = isBorrower ? transaction.owner : transaction.borrower;
  const role = isBorrower ? 'borrower_to_owner' : 'owner_to_borrower';

  const review = await Review.create({
    transaction: transaction._id,
    item: transaction.item._id,
    reviewer: req.user._id,
    reviewee: revieweeId,
    role,
    rating: validated.rating,
    comment: validated.comment || '',
  });

  if (isBorrower) {
    transaction.borrowerReviewed = true;
  } else {
    transaction.ownerReviewed = true;
  }
  await transaction.save();

  await Promise.all([
    syncUserReputation(revieweeId),
    Notification.create({
      recipient: revieweeId,
      sender: req.user._id,
      type: 'REVIEW_RECEIVED',
      title: `New ${validated.rating}-Star Review Received`,
      message: `${req.user.name} left you a ${validated.rating}/5 star review for "${
        (transaction.item as any).title || 'an item'
      }".`,
      relatedItem: transaction.item._id,
      relatedRequest: transaction._id,
    }),
  ]);

  const populated = await Review.findById(review._id)
    .populate('reviewer', 'name department year')
    .populate('reviewee', 'name department year')
    .populate('item', 'title category');

  res.status(201).json({
    success: true,
    message: 'Review submitted! Thank you for building campus trust.',
    review: populated,
  });
});

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({ reviewee: req.params.userId })
    .populate('reviewer', 'name department year')
    .populate('item', 'title category')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    reviews,
  });
});
