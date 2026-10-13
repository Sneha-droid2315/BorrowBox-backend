import mongoose, { Document, Schema } from 'mongoose';
import { REPORT_REASONS, REPORT_STATUSES } from '../utils/constants';

export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  reporter: mongoose.Types.ObjectId;
  targetType: 'item' | 'user';
  targetItem?: mongoose.Types.ObjectId;
  targetUser?: mongoose.Types.ObjectId;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  adminNotes?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },
    targetType: {
      type: String,
      enum: ['item', 'user'],
      required: [true, 'Target type is required'],
    },
    targetItem: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: [true, 'Report reason is required'],
    },
    description: {
      type: String,
      required: [true, 'Report description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'Pending',
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters'],
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
