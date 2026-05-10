import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { ValidationError } from '../types/errors';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new ValidationError('Only ZIP files are accepted'));
    }
    cb(null, true);
  },
});
