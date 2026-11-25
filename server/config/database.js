import mongoose from 'mongoose';

export function mongoUri() {
  return (
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/api_breaking_change_detector'
  );
}

/**
 * Connects to MongoDB.
 *
 * Comparison endpoints work without a database, so a failed connection is
 * reported through GET /api/health instead of stopping the server. Accounts,
 * projects and comparison history need MongoDB.
 */
export async function connectDatabase() {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 4000 });
    return { connected: true, mode: 'mongodb' };
  } catch (error) {
    return { connected: false, mode: 'memory', error: error.message };
  }
}

export function databaseState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}
