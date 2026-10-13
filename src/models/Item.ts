import mongoose, { Document, Schema } from 'mongoose';
import {
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  ITEM_STATUSES,
  ItemCategory,
  ItemCondition,
  ItemStatus,
} from '../utils/constants';

export interface IItem extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
  images: string[];
  pickupLocation: string;
  owner: mongoose.Types.ObjectId;
  status: ItemStatus;
  isOwnerDisabled: boolean;
  maxBorrowDays: number;
  depositNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    title: {
      type: String,
      required: [true, 'Item title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ITEM_CATEGORIES,
        message: '{VALUE} is not a valid category',
      },
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: {
        values: ITEM_CONDITIONS,
        message: '{VALUE} is not a valid condition',
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 5,
        message: 'Cannot upload more than 5 images per item',
      },
    },
    pickupLocation: {
      type: String,
      required: [true, 'Pickup location is required'],
      trim: true,
      minlength: [3, 'Pickup location must be at least 3 characters'],
      maxlength: [200, 'Pickup location cannot exceed 200 characters'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ITEM_STATUSES,
      default: 'Available',
      index: true,
    },
    isOwnerDisabled: {
      type: Boolean,
      default: false,
    },
    maxBorrowDays: {
      type: Number,
      default: 14,
      min: [1, 'Minimum max borrow days is 1'],
      max: [90, 'Maximum borrow days cannot exceed 90'],
    },
    depositNote: {
      type: String,
      trim: true,
      maxlength: [300, 'Deposit/terms note cannot exceed 300 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

ItemSchema.index({ category: 1, condition: 1, status: 1 });
ItemSchema.index({ createdAt: -1 });
ItemSchema.index({ title: 'text', description: 'text' });

export const Item = mongoose.model<IItem>('Item', ItemSchema);
