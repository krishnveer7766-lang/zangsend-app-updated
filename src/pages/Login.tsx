import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 safe-area-top safe-area-bottom">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8 slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 pulse-glow">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-text-primary">
            Welcome back
          </h1>
          <p className="mt-2 text-sm md:text-base text-text-secondary">
            Sign in to your ZangSends account
          </p>
        </div>

        {/* Login Form */}
        <form className="space-y-5" onSubmit={handleLogin}>
          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-xl bg-status-bounced/10 border border-status-bounced/20 
                          text-status-bounced text-sm spring-in">
              {error}
            </div>
          )}
          
          {/* Email Field */}
          <div className="slide-up" style={{ animationDelay: '50ms' }}>
            <label className="label">Email address</label>
            <input
              type="email"
              required
              className="input-field"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
            />
          </div>

          {/* Password Field */}
          <div className="slide-up" style={{ animationDelay: '100ms' }}>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-field pr-12"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-tertiary 
                         hover:text-text-secondary rounded-lg transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="slide-up" style={{ animationDelay: '150ms' }}>
            <button 
              type="submit" 
              disabled={loading} 
              className="btn btn-primary w-full h-12 text-base font-semibold group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sign Up Link */}
        <p className="mt-8 text-center text-sm text-text-secondary slide-up" style={{ animationDelay: '200ms' }}>
          Don&apos;t have an account?{' '}
          <Link 
            to="/signup" 
            className="text-primary hover:text-primary-dim font-medium transition-colors
                     hover:underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-text-tertiary">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}
