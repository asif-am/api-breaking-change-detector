import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import { Field, FormError } from '../components/Form.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/projects';

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const signedIn = await login(form.email, form.password);
      toast.success(`Signed in as ${signedIn.name}.`);
      navigate(from, { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      intro="Projects and comparison history are private to your account."
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="link">
            Create one
          </Link>
          . Comparing on the home page needs no account.
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />

        <div>
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-[12px] text-graphite hover:text-ink">
              Forgot password
            </Link>
          </div>
        </div>

        <FormError>{error}</FormError>

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
