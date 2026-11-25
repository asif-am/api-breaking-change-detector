import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password: form.password,
      });
      setDone(true);
      toast.success(response.data.message);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-600">
          The reset link can be used once and expires 30 minutes after it was generated.
        </p>

        {!token ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              This page needs a reset link. Request one with your email address.
            </p>
            <Link to="/forgot-password" className="btn-primary w-full">
              Request a reset link
            </Link>
          </div>
        ) : done ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Your password has been updated. Sign in with the new password.
            </p>
            <Link to="/login" className="btn-primary w-full">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className="input"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">At least 6 characters.</p>
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className="input"
                value={form.confirm}
                onChange={(event) => setForm({ ...form, confirm: event.target.value })}
              />
            </div>

            {error ? (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                <p>{error}</p>
                <Link
                  to="/forgot-password"
                  className="mt-1 inline-block text-xs font-semibold text-rose-800 underline"
                >
                  Request a new reset link
                </Link>
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
