import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { SpecificationError } from './engine/index.js';

/* ---------------------------------- auth --------------------------------- */

/** Guard for private routes: no session → 401. */
export function isLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ success: false, message: 'Authentication required.' });
}

/* ------------------------------ rate limits ------------------------------ */

/** Limits credential stuffing on the sign-in and sign-up endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait a few minutes and try again.',
  },
});

/** Limits abusive comparison traffic on the public analysis endpoints. */
export const compareLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many comparison requests. Please wait a minute and try again.',
  },
});

/* ------------------------------ validation ------------------------------- */

/** Validates req.body against a Joi schema and replaces it with the parsed value. */
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(422).json({
        success: false,
        message: 'Please correct the highlighted fields.',
        issues: error.details.map((detail) => ({
          code: detail.type,
          path: detail.path.join('.'),
          message: detail.message.replace(/"/g, ''),
        })),
      });
    }

    req.body = value;
    return next();
  };
}

/* --------------------------------- upload -------------------------------- */

/** Spec uploads are held in memory (max 5 MB) and never written to disk. */
const storage = multer.memoryStorage();

function isJsonFile(file) {
  const name = (file.originalname || '').toLowerCase();
  const type = (file.mimetype || '').toLowerCase();
  return name.endsWith('.json') || type === 'application/json' || type === 'text/json' || type === '';
}

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter(req, file, callback) {
    if (!isJsonFile(file)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only .json OpenAPI documents can be uploaded.'));
    }
    return callback(null, true);
  },
});

/* ------------------------------- security -------------------------------- */

/** Baseline hardening headers for both the API and the built React client. */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return next();
}

/* -------------------------------- errors --------------------------------- */

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/** Central error handler so every failure returns the same JSON envelope. */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  // Body-parser failures are client errors, not server failures.
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'The request body is not valid JSON.',
    });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'The request body exceeds the 8 MB limit.',
    });
  }

  if (error instanceof SpecificationError) {
    return res.status(error.statusCode || 422).json({
      success: false,
      message: error.message,
      issues: error.issues,
    });
  }

  if (error?.name === 'MulterError') {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded file is larger than the 5 MB limit.'
        : error.message || 'The upload could not be processed.';
    return res.status(400).json({ success: false, message });
  }

  if (error?.name === 'UserExistsError') {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists.',
    });
  }

  if (error?.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      message: 'The submitted data failed validation.',
      issues: Object.values(error.errors || {}).map((item) => ({
        code: 'validation-error',
        path: item.path,
        message: item.message,
      })),
    });
  }

  if (error?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'The supplied identifier is not valid.' });
  }

  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists.',
    });
  }

  console.error('[error]', error);
  return res.status(500).json({ success: false, message: 'Internal server error.' });
}
