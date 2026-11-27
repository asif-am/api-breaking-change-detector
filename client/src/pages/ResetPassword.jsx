import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import { Field, FormError } from '../components/Form.jsx';

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
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      intro="The reset link can be used once and expires 30 minutes after it was generated."
      footer={
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      {!token ? (
        <div className="space-y-4">
          <FormError>This page needs a reset link. Request one with your email address.</FormError>
          <Link to="/forgot-password" className="btn btn-primary w-full">
            Request a reset link
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-moss/25 bg-moss-soft px-3 py-2.5 text-[13px] leading-5 text-moss">
            Your password has been updated. Sign in with the new password.
          </p>
          <Link to="/login" className="btn btn-primary w-full">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={72}
            hint="At least 6 characters."
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <Field
            id="confirm"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={72}
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          />

          {error ? (
            <FormError>
              <p>{error}</p>
              <Link to="/forgot-password" className="mt-1 inline-block text-[12px] underline">
                Request a new reset link
              </Link>
            </FormError>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
