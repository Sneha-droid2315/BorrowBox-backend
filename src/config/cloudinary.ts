import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env, isCloudinaryConfigured } from './env';

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Uploads an image buffer to Cloudinary when credentials are configured.
 * If Cloudinary credentials are missing, falls back to saving the file in
 * `server/uploads/` and serving it via `/uploads/<filename>` so local development
 * works seamlessly without external credentials.
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

  // Documented Development Fallback: Save image locally to server/uploads/
  const ext = path.extname(originalName).toLowerCase() || (mimeType === 'image/png' ? '.png' : '.jpg');
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
  const fileName = `item_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
};
