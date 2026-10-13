import { Response } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Item } from '../models/Item';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';

export const getWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const wishlistEntries = await Wishlist.find({ user: req.user._id })
    .populate({
      path: 'item',
      populate: {
        path: 'owner',
        select: 'name department year reputation',
      },
    })
    .sort({ createdAt: -1 });

  // Filter out entries where the underlying item might have been deleted
  const validItems = wishlistEntries.filter((entry) => entry.item !== null);

  res.status(200).json({
    success: true,
    wishlist: validItems,
  });
});

export const addToWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const { itemId } = req.params;
  const item = await Item.findById(itemId);
  if (!item) {
    throw new AppError('Item not found.', 404);
  }

  const existing = await Wishlist.findOne({ user: req.user._id, item: item._id });
  if (existing) {
    res.status(200).json({
      success: true,
      message: 'Item is already in your wishlist.',
      inWishlist: true,
    });
    return;
  }

  await Wishlist.create({
    user: req.user._id,
    item: item._id,
  });

  res.status(201).json({
    success: true,
    message: 'Item saved to your wishlist.',
    inWishlist: true,
  });
});

export const removeFromWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const { itemId } = req.params;
  await Wishlist.findOneAndDelete({ user: req.user._id, item: itemId });

  res.status(200).json({
    success: true,
    message: 'Item removed from your wishlist.',
    inWishlist: false,
  });
});
