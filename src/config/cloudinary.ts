import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env, isCloudinaryConfigured } from './env';
import { AppError } from '../utils/AppError';

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

/**
 * Uploads an image buffer to Cloudinary when credentials are configured.
 * - On localhost without Cloudinary: saves to `server/uploads/` and serves via `/uploads/<filename>`.
 * - On Vercel/serverless without Cloudinary: avoids read-only filesystem crashes by encoding compact
 *   images as data URLs or prompting for Cloudinary configuration.
 */
export const uploadImageBuffer = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> => {
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'borrowbox_items',
          resource_type: 'image',
          transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload failed'));
          }
          resolve(result.secure_url);
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Cloud / Serverless environments (Vercel / Render) have read-only or ephemeral filesystems
  if (process.env.VERCEL || process.env.RENDER || env.NODE_ENV === 'production') {
    if (buffer.length <= 1.5 * 1024 * 1024) {
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
    throw new AppError(
      'Cloudinary credentials are not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Environment Variables, or upload an image smaller than 1.5 MB.',
      400
    );
  }

  // Localhost Development Fallback: Save image locally to server/uploads/
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  const ext =
    path.extname(originalName).toLowerCase() ||
    (mimeType === 'image/png' ? '.png' : '.jpg');
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
  const fileName = `item_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
};
