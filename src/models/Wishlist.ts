import mongoose, { Document, Schema } from 'mongoose';

export interface IWishlist extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema = new Schema<IWishlist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    item: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

WishlistSchema.index({ user: 1, item: 1 }, { unique: true });

export const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema);
