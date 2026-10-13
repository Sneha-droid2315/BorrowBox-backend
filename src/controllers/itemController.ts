import { Request, Response } from 'express';
import { z } from 'zod';
import { Item } from '../models/Item';
import { BorrowRequest } from '../models/BorrowRequest';
import { Review } from '../models/Review';
import { Wishlist } from '../models/Wishlist';
import { ITEM_CATEGORIES, ITEM_CONDITIONS, ITEM_STATUSES } from '../utils/constants';
import { uploadImageBuffer } from '../config/cloudinary';
import { AppError, asyncHandler } from '../utils/AppError';
import { AuthRequest } from '../middleware/authMiddleware';

const createItemSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.enum(ITEM_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
  condition: z.enum(ITEM_CONDITIONS, {
    errorMap: () => ({ message: 'Please select a valid condition' }),
  }),
  pickupLocation: z
    .string()
    .trim()
    .min(3, 'Pickup location must be at least 3 characters')
    .max(200),
  maxBorrowDays: z.coerce.number().int().min(1).max(90).optional().default(14),
  depositNote: z.string().trim().max(300).optional().default(''),
  existingImages: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        // treat as single URL string
      }
      return val.trim() ? [val.trim()] : [];
    }),
});

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getItems = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12));
  const skip = (page - 1) * limit;

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const condition = typeof req.query.condition === 'string' ? req.query.condition.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'newest';
  const ownerId = typeof req.query.owner === 'string' ? req.query.owner.trim() : '';

  const filter: Record<string, any> = {};

  if (search) {
    const safeRegex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: safeRegex },
      { description: safeRegex },
      { pickupLocation: safeRegex },
    ];
  }

  if (category && category !== 'All' && ITEM_CATEGORIES.includes(category as any)) {
    filter.category = category;
  }

  if (condition && condition !== 'All' && ITEM_CONDITIONS.includes(condition as any)) {
    filter.condition = condition;
  }

  if (status && status !== 'All' && ITEM_STATUSES.includes(status as any)) {
    filter.status = status;
  } else if (!status) {
    // By default in public browse, show items that aren't hidden/disabled unless status='All'
    filter.status = { $ne: 'Unavailable' };
  }

  if (ownerId) {
    filter.owner = ownerId;
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'title_asc') {
    sortOption = { title: 1 };
  } else if (sort === 'title_desc') {
    sortOption = { title: -1 };
  }

  const [items, total] = await Promise.all([
    Item.find(filter)
      .populate('owner', 'name department year reputation')
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    Item.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    items,
    pagination: {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    },
  });
});

export const getItemById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const item = await Item.findById(req.params.id).populate(
    'owner',
    'name email department year phone bio reputation createdAt'
  );

  if (!item) {
    throw new AppError('Item listing not found.', 404);
  }

  const reviews = await Review.find({ item: item._id })
    .populate('reviewer', 'name department year')
    .sort({ createdAt: -1 })
    .limit(20);

  let isWishlisted = false;
  let myActiveRequest = null;

  if (req.user) {
    const [wishlistDoc, activeReq] = await Promise.all([
      Wishlist.findOne({ user: req.user._id, item: item._id }),
      BorrowRequest.findOne({
        item: item._id,
        borrower: req.user._id,
        status: { $in: ['Pending', 'Accepted', 'Borrowed'] },
      }),
    ]);
    isWishlisted = Boolean(wishlistDoc);
    myActiveRequest = activeReq;
  }

  res.status(200).json({
    success: true,
    item,
    reviews,
    isWishlisted,
    myActiveRequest,
  });
});

export const getMyListings = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const items = await Item.find({ owner: req.user._id }).sort({ createdAt: -1 });

  const itemIds = items.map((i) => i._id);
  const activeRequests = await BorrowRequest.find({
    item: { $in: itemIds },
    status: { $in: ['Pending', 'Accepted', 'Borrowed'] },
  }).populate('borrower', 'name email department year');

  const itemsWithStats = items.map((item) => {
    const related = activeRequests.filter(
      (r) => r.item.toString() === item._id.toString()
    );
    const pendingCount = related.filter((r) => r.status === 'Pending').length;
    const activeBooking = related.find((r) =>
      ['Accepted', 'Borrowed'].includes(r.status)
    );
    return {
      ...item.toJSON(),
      pendingRequestsCount: pendingCount,
      activeBooking: activeBooking || null,
    };
  });

  res.status(200).json({
    success: true,
    items: itemsWithStats,
  });
});

export const createItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const validated = createItemSchema.parse(req.body);
  const files = (req.files as Express.Multer.File[]) || [];

  const uploadedUrls: string[] = [...validated.existingImages];

  for (const file of files) {
    const url = await uploadImageBuffer(file.buffer, file.originalname, file.mimetype);
    uploadedUrls.push(url);
  }

  if (uploadedUrls.length > 5) {
    throw new AppError('Maximum 5 images allowed per item.', 400);
  }

  const item = await Item.create({
    title: validated.title,
    description: validated.description,
    category: validated.category,
    condition: validated.condition,
    images: uploadedUrls,
    pickupLocation: validated.pickupLocation,
    maxBorrowDays: validated.maxBorrowDays,
    depositNote: validated.depositNote,
    owner: req.user._id,
    status: 'Available',
    isOwnerDisabled: false,
  });

  const populated = await item.populate('owner', 'name department year reputation');

  res.status(201).json({
    success: true,
    message: 'Item listed successfully!',
    item: populated,
  });
});

export const updateItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const item = await Item.findById(req.params.id);
  if (!item) {
    throw new AppError('Item not found.', 404);
  }

  const isOwner = item.owner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to edit this listing.', 403);
  }

  const validated = createItemSchema.parse(req.body);
  const files = (req.files as Express.Multer.File[]) || [];

  const updatedImages: string[] = [...validated.existingImages];
  for (const file of files) {
    const url = await uploadImageBuffer(file.buffer, file.originalname, file.mimetype);
    updatedImages.push(url);
  }

  if (updatedImages.length > 5) {
    throw new AppError('Maximum 5 images allowed per item.', 400);
  }

  item.title = validated.title;
  item.description = validated.description;
  item.category = validated.category;
  item.condition = validated.condition;
  item.pickupLocation = validated.pickupLocation;
  item.maxBorrowDays = validated.maxBorrowDays;
  item.depositNote = validated.depositNote;
  if (updatedImages.length > 0 || req.body.existingImages !== undefined) {
    item.images = updatedImages;
  }

  await item.save();
  const populated = await item.populate('owner', 'name department year reputation');

  res.status(200).json({
    success: true,
    message: 'Item listing updated successfully.',
    item: populated,
  });
});

export const toggleItemAvailability = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      throw new AppError('Item not found.', 404);
    }

    if (item.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('You are not authorized to change this item availability.', 403);
    }

    if (item.status === 'Reserved' || item.status === 'Borrowed') {
      item.isOwnerDisabled = !item.isOwnerDisabled;
      await item.save();
      res.status(200).json({
        success: true,
        message: item.isOwnerDisabled
          ? 'Item will become Unavailable automatically once the current borrow ends.'
          : 'Item will return to Available once the current borrow ends.',
        item,
      });
      return;
    }

    if (item.status === 'Available') {
      item.status = 'Unavailable';
      item.isOwnerDisabled = true;
    } else {
      item.status = 'Available';
      item.isOwnerDisabled = false;
    }

    await item.save();

    res.status(200).json({
      success: true,
      message: `Listing is now ${item.status}.`,
      item,
    });
  }
);

export const deleteItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const item = await Item.findById(req.params.id);
  if (!item) {
    throw new AppError('Item not found.', 404);
  }

  const isOwner = item.owner.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to delete this listing.', 403);
  }

  const activeTransaction = await BorrowRequest.findOne({
    item: item._id,
    status: { $in: ['Accepted', 'Borrowed'] },
  });

  if (activeTransaction) {
    throw new AppError(
      'Cannot delete an item while it has an accepted or active borrowing in progress.',
      400
    );
  }

  await Promise.all([
    BorrowRequest.updateMany(
      { item: item._id, status: 'Pending' },
      { $set: { status: 'Cancelled', ownerResponseNote: 'Listing was removed by owner.' } }
    ),
    Wishlist.deleteMany({ item: item._id }),
    Item.findByIdAndDelete(item._id),
  ]);

  res.status(200).json({
    success: true,
    message: 'Item listing deleted successfully.',
  });
});
