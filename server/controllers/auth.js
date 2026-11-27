import crypto from 'node:crypto';
import passport from 'passport';
import User from '../models/user.js';

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });
const EMAIL_TAKEN = 'An account with this email already exists.';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_RESPONSE_MESSAGE =
  'If an account matches that email, a password reset link has been generated.';

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const resetUrlFor = (token) =>
  `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')}/reset-password?token=${token}`;

/** POST /api/auth/register */
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: EMAIL_TAKEN });

    const registered = await User.register(new User({ name, email }), password);

    return req.login(registered, (error) => {
      if (error) return next(error);
      return res.status(201).json({ success: true, data: { user: publicUser(registered) } });
    });
  } catch (error) {
    if (error?.name === 'UserExistsError') {
      return res.status(409).json({ success: false, message: EMAIL_TAKEN });
    }
    return next(error);
  }
}

/** POST /api/auth/login */
export function login(req, res, next) {
  passport.authenticate('local', (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    return req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      return res.json({ success: true, data: { user: publicUser(user) } });
    });
  })(req, res, next);
}

/** POST /api/auth/logout */
export function logout(req, res, next) {
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Signed out.' });
    });
  });
}

/** GET /api/auth/me — returns null instead of 401 when signed out. */
export function me(req, res) {
  return res.json({ success: true, data: { user: req.user ? publicUser(req.user) : null } });
}

/**
 * POST /api/auth/forgot-password — issues a single-use reset token.
 *
 * The same response is returned for known and unknown addresses so the endpoint
 * cannot be used to discover which emails have accounts. No mail provider is
 * configured for this project, so outside production the token is echoed in the
 * response (development delivery) instead of being emailed.
 */
export async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: true, message: RESET_RESPONSE_MESSAGE });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = hashResetToken(token);
    user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const payload = { success: true, message: RESET_RESPONSE_MESSAGE };

    if (process.env.NODE_ENV !== 'production') {
      payload.data = {
        resetToken: token,
        resetUrl: resetUrlFor(token),
        expiresInMinutes: RESET_TOKEN_TTL_MS / 60000,
        delivery: 'development-echo',
      };
    }

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/reset-password — consumes the token and sets a new password.
 * A token is valid once, for 30 minutes, and only its hash is stored.
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetTokenHash: hashResetToken(token),
      resetTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Request a new one.',
      });
    }

    await new Promise((resolve, reject) => {
      user.setPassword(password, (error) => (error ? reject(error) : resolve()));
    });

    // Single use: clearing the token means the link cannot be replayed.
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Your password has been updated. Sign in with the new password.',
    });
  } catch (error) {
    return next(error);
  }
}
