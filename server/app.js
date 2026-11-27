import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import connectMongo from 'connect-mongo';
import flash from 'connect-flash';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { connectDatabase, mongoUri } from './config/database.js';
import { setPersistenceMode } from './data/store.js';
import { errorHandler, notFound, securityHeaders } from './middleware.js';
import User from './models/user.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import comparisonRoutes from './routes/comparison.js';
import projectRoutes from './routes/project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable('x-powered-by');

// Database
const connection = await connectDatabase();
setPersistenceMode(connection.mode);

if (connection.connected) {
  console.log('MongoDB connected — accounts, projects and history are persisted.');
} else {
  console.warn('MongoDB is not reachable — comparison endpoints still work, sign-in is unavailable.');
  console.warn(`Reason: ${connection.error}`);
}

// Config
app.set('trust proxy', 1);

const allowedOrigins = new Set([
  (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
]);

app.use(securityHeaders);

// Vite may fall back to another port when 5173 is taken; every loopback port is local dev only.
const isLocalDevOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

// Session & Passport
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production.');
}

if (!sessionSecret) {
  console.warn('SESSION_SECRET is not set — using the development fallback from server/.env.example.');
}

const sessionOptions = {
  secret: sessionSecret || 'apna-college-web-development-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

if (connection.connected) {
  sessionOptions.store = connectMongo.create({
    mongoUrl: mongoUri(),
    touchAfter: 24 * 3600,
  });
}

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({ usernameField: 'email' }, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/comparisons', comparisonRoutes);
app.use('/api', apiRoutes);

// The React build is served by Express in production so the demo is one command.
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use('/api', notFound);
app.use(errorHandler);

// Server
const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`API Breaking Change Detector listening on http://localhost:${PORT}`);
});
