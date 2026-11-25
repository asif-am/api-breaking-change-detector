import passport from 'passport';
import User from '../models/user.js';

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

/** POST /api/auth/register */
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const registered = await User.register(new User({ name, email }), password);

    return req.login(registered, (error) => {
      if (error) return next(error);
      return res.status(201).json({ success: true, data: { user: publicUser(registered) } });
    });
  } catch (error) {
    if (error?.name === 'UserExistsError') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
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
