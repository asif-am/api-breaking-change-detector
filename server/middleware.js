import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { SpecificationError } from './engine/index.js';

/** Every failure uses the same JSON envelope. */
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

/* ---------------------------------- auth --------------------------------- */

/** Guard for private routes: no session → 401. */
export function isLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return fail(res, 401, 'Authentication required.');
}

/* ------------------------------ rate limits ------------------------------ */

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message } });

/** Limits credential stuffing on the sign-in, sign-up and reset endpoints. */
export const authLimiter = limiter(
  15 * 60 * 1000,
  20,
  'Too many authentication attempts. Please wait a few minutes and try again.'
);

/** Limits abusive comparison traffic on the public analysis endpoints. */
export const compareLimiter = limiter(
  60 * 1000,
  30,
  'Too many comparison requests. Please wait a minute and try again.'
);

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
      const issues = error.details.map((detail) => ({
        code: detail.type,
        path: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));
      return fail(res, 422, 'Please correct the highlighted fields.', { issues });
    }

    req.body = value;
    return next();
  };
}

/* --------------------------------- upload -------------------------------- */

function isJsonFile(file) {
  const name = (file.originalname || '').toLowerCase();
  const type = (file.mimetype || '').toLowerCase();
  return name.endsWith('.json') || type === 'application/json' || type === 'text/json' || type === '';
}

/** Spec uploads are held in memory (max 5 MB) and never written to disk. */
export const upload = multer({
  storage: multer.memoryStorage(),
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
  return fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

/** Central error handler so every failure returns the same JSON envelope. */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  // Body-parser failures are client errors, not server failures.
  if (error?.type === 'entity.parse.failed') return fail(res, 400, 'The request body is not valid JSON.');
  if (error?.type === 'entity.too.large') return fail(res, 413, 'The request body exceeds the 8 MB limit.');

  if (error instanceof SpecificationError) {
    return fail(res, error.statusCode || 422, error.message, { issues: error.issues });
  }

  if (error?.name === 'MulterError') {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded file is larger than the 5 MB limit.'
        : error.message || 'The upload could not be processed.';
    return fail(res, 400, message);
  }

  if (error?.name === 'UserExistsError' || error?.code === 11000) {
    return fail(res, 409, 'An account with this email already exists.');
  }

  if (error?.name === 'ValidationError') {
    const issues = Object.values(error.errors || {}).map((item) => ({
      code: 'validation-error',
      path: item.path,
      message: item.message,
    }));
    return fail(res, 422, 'The submitted data failed validation.', { issues });
  }

  if (error?.name === 'CastError') return fail(res, 400, 'The supplied identifier is not valid.');

  console.error('[error]', error);
  return fail(res, 500, 'Internal server error.');
}
