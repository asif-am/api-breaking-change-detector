import axios from 'axios';

/**
 * Single axios instance for the whole app.
 * Vite proxies /api to http://localhost:5000 during development, and Express
 * serves the built client in production, so the base path is always /api.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

export function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

export function errorIssues(error) {
  return error?.response?.data?.issues || [];
}

export default api;
