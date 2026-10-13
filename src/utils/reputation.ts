import mongoose from 'mongoose';
import { User } from '../models/User';
import { BorrowRequest } from '../models/BorrowRequest';
import { Review } from '../models/Review';

/**
 * Transparently recalculates and updates a user's reputation statistics
 * based on completed transactions (Returned) and reviews received.
 */
export const syncUserReputation = async (
  userId: mongoose.Types.ObjectId | string
): Promise<void> => {
  const objectId =
    typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const [completedBorrows, completedLends, onTimeReturns, ratingAgg] =
    await Promise.all([
      BorrowRequest.countDocuments({
        borrower: objectId,
        status: 'Returned',
      }),
      BorrowRequest.countDocuments({
        owner: objectId,
        status: 'Returned',
      }),
      BorrowRequest.countDocuments({
        borrower: objectId,
        status: 'Returned',
        wasReturnedOnTime: true,
      }),
      Review.aggregate([
        { $match: { reviewee: objectId } },
        {
          $group: {
            _id: '$reviewee',
            averageRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 },
          },
        },
      ]),
    ]);

  const averageRating = ratingAgg[0]
    ? Math.round(ratingAgg[0].averageRating * 10) / 10
    : 0;
  const totalRatings = ratingAgg[0]?.totalRatings || 0;

  await User.findByIdAndUpdate(objectId, {
    reputation: {
      completedBorrows,
      completedLends,
      onTimeReturns,
      averageRating,
      totalRatings,
    },
  });
};
