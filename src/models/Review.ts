import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  transaction: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId;
  reviewer: mongoose.Types.ObjectId;
  reviewee: mongoose.Types.ObjectId;
  role: 'borrower_to_owner' | 'owner_to_borrower';
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'BorrowRequest',
      required: [true, 'Transaction reference is required'],
      index: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item reference is required'],
      index: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
      index: true,
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewee is required'],
      index: true,
    },
    role: {
      type: String,
      enum: ['borrower_to_owner', 'owner_to_borrower'],
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating between 1 and 5 is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

ReviewSchema.index({ transaction: 1, reviewer: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
