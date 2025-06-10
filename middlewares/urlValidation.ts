import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

export function validateUrl(req: Request, res: Response, next: NextFunction) {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !validator.isURL(url, { require_protocol: true })) {
    return next(new Error('URL_VALIDATION_FAILED'));
  }
  next();
}

export function sanitizeUrl(req: Request, res: Response, next: NextFunction) {
  try {
    let url = decodeURIComponent(req.body.url.trim());
    url = validator.escape(url);
    req.body.url = url;
    next();
  } catch {
    next(new Error('URL_VALIDATION_FAILED'));
  }
}
