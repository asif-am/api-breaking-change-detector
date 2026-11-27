import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { errorIssues, errorMessage } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import { Field, FormError } from '../components/Form.jsx';
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
    <AuthShell
      title="Create an account"
      intro="Save projects, specifications and comparison history."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
          .
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field
          id="name"
          label="Full name"
          required
          minLength={2}
          maxLength={60}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={72}
          hint="At least 6 characters. Hashed and salted before storage."
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />

        {error ? (
          <FormError>
            <p>{error}</p>
            {issues.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-[12px]">
                {issues.map((issue) => (
                  <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
          </FormError>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
