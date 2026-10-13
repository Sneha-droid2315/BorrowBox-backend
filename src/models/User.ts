import mongoose, { Document, Schema } from 'mongoose';

export interface IReputation {
  completedBorrows: number;
  completedLends: number;
  onTimeReturns: number;
  averageRating: number;
  totalRatings: number;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'admin';
  department: string;
  year: string;
  phone?: string;
  bio?: string;
  reputation: IReputation;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },
    year: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      maxlength: [50, 'Year cannot exceed 50 characters'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [25, 'Phone number cannot exceed 25 characters'],
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    reputation: {
      completedBorrows: { type: Number, default: 0, min: 0 },
      completedLends: { type: Number, default: 0, min: 0 },
      onTimeReturns: { type: Number, default: 0, min: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalRatings: { type: Number, default: 0, min: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserSchema.index({ role: 1 });
UserSchema.index({ department: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
