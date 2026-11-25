import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errorIssues, errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/projects" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIssues([]);
    setLoading(true);
    try {
      const created = await register(form.name, form.email, form.password);
      toast.success(`Account created for ${created.name}.`);
      navigate('/projects', { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
      setIssues(errorIssues(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-900">Create an account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Save projects, specifications and comparison history.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              required
              minLength={2}
              maxLength={60}
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
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
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
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
            <p className="mt-1 text-xs text-slate-500">At least 6 characters. Hashed and salted before storage.</p>
          </div>

          {error ? (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <p>{error}</p>
              {issues.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs">
                  {issues.map((issue) => (
                    <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
