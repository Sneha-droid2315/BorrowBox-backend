import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || undefined;

  if (err instanceof ZodError) {
    statusCode = 400;
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    message = issues[0]?.message || 'Validation failed';
    details = issues;
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Each uploaded image must be smaller than 5 MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'You can upload up to 5 images per item.';
    } else {
      message = `File upload error: ${err.message}`;
    }
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    const fieldErrors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = fieldErrors[0]?.message || 'Database validation error';
    details = fieldErrors;
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path} ID format: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    message = `Duplicate value for ${field}. This record already exists.`;
  }

  if (statusCode === 500 && env.NODE_ENV !== 'test') {
    console.error('[Server Error]:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
    ...(env.NODE_ENV === 'development' && statusCode === 500 ? { stack: err.stack } : {}),
  });
};
