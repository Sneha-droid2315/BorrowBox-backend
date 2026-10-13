import multer from 'multer';
import { AppError } from '../utils/AppError';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.',
          400
        ) as unknown as Error
      );
    }
  },
});
