import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setResult({
        message: response.data.message,
        delivery: response.data.data || null,
      });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the email you registered with and we will generate a single-use reset link.
        </p>

        {result ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{result.message}</p>

            {result.delivery ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Development link</p>
                <p className="mt-1 text-xs">
                  No mail provider is configured, so the link is returned here instead of being emailed. It expires
                  in {result.delivery.expiresInMinutes} minutes and works only once.
                </p>
                <Link
                  to={`/reset-password?token=${result.delivery.resetToken}`}
                  className="btn-primary mt-3 w-full"
                >
                  Continue to set a new password
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Check your inbox for the reset link. If it does not arrive, request another one in a few minutes.
              </p>
            )}

            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => {
                setResult(null);
                setEmail('');
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Generating link…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-slate-600">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Back to sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
