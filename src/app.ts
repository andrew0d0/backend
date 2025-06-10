import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateUrl, sanitizeUrl } from './middlewares/urlValidation';
import { bypassAdLink } from './services/linkBypassService';
import 'express-async-errors';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait and try again.' }
});
app.use(limiter);

interface BypassRequestBody {
  url: string;
}

interface BypassResponse {
  originalUrl: string;
  finalUrl: string;
  metadata?: {
    title?: string;
    description?: string;
  };
  warnings?: string[];
}

app.post(
  '/api/bypass',
  validateUrl,
  sanitizeUrl,
  async (req: Request<{}, {}, BypassRequestBody>, res: Response<BypassResponse | { error: string }>, next: NextFunction) => {
    const { url } = req.body;
    try {
      const { finalUrl, metadata, warnings } = await bypassAdLink(url);

      res.json({
        originalUrl: url,
        finalUrl,
        metadata,
        warnings,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Backend Error:', err);

  if (err.message === 'URL_VALIDATION_FAILED') {
    return res.status(400).json({ error: 'Invalid URL provided.' });
  }
  if (err.message === 'CAPTCHA_DETECTED') {
    return res.status(429).json({ error: 'Captcha detected. Cannot bypass link.' });
  }
  if (err.message === 'RATE_LIMITED') {
    return res.status(429).json({ error: 'Rate limited by target site.' });
  }

  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
