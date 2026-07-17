import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoMailOutline, IoLockClosedOutline } from 'react-icons/io5';
import Toast from '../components/Toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const { login, user, error, setError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Clear context errors on load
    setError(null);
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate, setError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    setLocalLoading(true);
    const result = await login(email, password);
    setLocalLoading(false);

    if (result.success) {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-chatBg bg-chat-pattern bg-repeat px-4 overflow-hidden">
      {/* Decorative backdrop glow */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-chatAccent/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none"></div>

      <div className="z-10 w-full max-w-md rounded-2xl glass-card p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            🚀 <span className="bg-gradient-to-r from-chatAccent to-blue-400 bg-clip-text text-transparent">ProChat AI</span>
          </h1>
          <p className="mt-2 text-sm text-chatMuted">Intelligent Real-Time Communication Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
              {formError}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-chatMuted uppercase tracking-wider mb-2">
              Email / Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-chatMuted">
                <IoMailOutline className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email or username"
                className="w-full rounded-xl border border-chatBorder bg-chatPanel/50 py-3 pl-10 pr-4 text-white placeholder-chatMuted focus:border-chatAccent focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-chatMuted uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-chatMuted">
                <IoLockClosedOutline className="h-5 w-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-chatBorder bg-chatPanel/50 py-3 pl-10 pr-4 text-white placeholder-chatMuted focus:border-chatAccent focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={localLoading}
            className="w-full rounded-xl bg-chatAccent py-3 font-semibold text-white hover:bg-opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {localLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-chatMuted">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-chatAccent hover:underline">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
