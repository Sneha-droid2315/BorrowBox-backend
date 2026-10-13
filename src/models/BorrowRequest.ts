import mongoose, { Document, Schema } from 'mongoose';
import { REQUEST_STATUSES, RequestStatus } from '../utils/constants';

export interface IBorrowRequest extends Document {
  _id: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId;
  borrower: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  message: string;
  pickupDate: Date;
  expectedReturnDate: Date;
  status: RequestStatus;
  ownerResponseNote?: string;
  handoverCode?: string;
  acceptedAt?: Date;
  rejectedAt?: Date;
  handoverConfirmedAt?: Date;
  returnedAt?: Date;
  wasReturnedOnTime?: boolean;
  returnConditionNote?: string;
  borrowerReviewed: boolean;
  ownerReviewed: boolean;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BorrowRequestSchema = new Schema<IBorrowRequest>(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item reference is required'],
      index: true,
    },
    borrower: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Borrower reference is required'],
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner reference is required'],
      index: true,
    },
    message: {
      type: String,
      required: [true, 'Please include a message for the item owner'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    pickupDate: {
      type: Date,
      required: [true, 'Pickup date is required'],
    },
    expectedReturnDate: {
      type: Date,
      required: [true, 'Expected return date is required'],
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'Pending',
      index: true,
    },
    ownerResponseNote: {
      type: String,
      trim: true,
      maxlength: [500, 'Response note cannot exceed 500 characters'],
    },
    handoverCode: {
      type: String,
      trim: true,
    },
    acceptedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    handoverConfirmedAt: {
      type: Date,
    },
    returnedAt: {
      type: Date,
    },
    wasReturnedOnTime: {
      type: Boolean,
    },
    returnConditionNote: {
      type: String,
      trim: true,
      maxlength: [500, 'Return note cannot exceed 500 characters'],
    },
    borrowerReviewed: {
      type: Boolean,
      default: false,
    },
    ownerReviewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BorrowRequestSchema.virtual('isOverdue').get(function (this: IBorrowRequest) {
  if (this.status !== 'Borrowed') return false;
  return new Date(this.expectedReturnDate).getTime() < Date.now();
});

BorrowRequestSchema.index({ item: 1, status: 1 });
BorrowRequestSchema.index({ borrower: 1, status: 1, createdAt: -1 });
BorrowRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });

export const BorrowRequest = mongoose.model<IBorrowRequest>(
  'BorrowRequest',
  BorrowRequestSchema
);
