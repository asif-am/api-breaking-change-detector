import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import { Field, FormError } from '../components/Form.jsx';

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
      const { data } = await api.post('/auth/forgot-password', { email });
      setResult({ message: data.message, delivery: data.data || null });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      intro="Enter the email you registered with and we will generate a single-use reset link."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="link">
            Back to sign in
          </Link>
          .
        </>
      }
    >
      {result ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-moss/25 bg-moss-soft px-3 py-2.5 text-[13px] leading-5 text-moss">
            {result.message}
          </p>

          {result.delivery ? (
            <div className="rounded-lg border border-dashed border-ochre/40 bg-ochre-soft p-3">
              <p className="font-mono text-[11px] text-ochre">development link</p>
              <p className="mt-1.5 text-[12px] leading-5 text-graphite">
                No mail provider is configured, so the link is returned here instead of being emailed. It expires
                in {result.delivery.expiresInMinutes} minutes and works once.
              </p>
              <Link to={`/reset-password?token=${result.delivery.resetToken}`} className="btn btn-primary mt-3 w-full">
                Set a new password
              </Link>
            </div>
          ) : (
            <p className="text-[13px] leading-6 text-graphite">
              Check your inbox for the reset link. If it does not arrive, request another one in a few minutes.
            </p>
          )}

          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => {
              setResult(null);
              setEmail('');
            }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <FormError>{error}</FormError>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Generating link…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
