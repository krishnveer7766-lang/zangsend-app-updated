import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 safe-area-top safe-area-bottom">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="w-full max-w-sm text-center relative z-10 scale-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 pulse-glow">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-display tracking-tight text-text-primary font-bold">
            Check your email
          </h2>
          <p className="mt-3 text-sm md:text-base text-text-secondary">
            We sent a confirmation link to
          </p>
          <p className="mt-1 text-primary font-medium">{email}</p>
          <Link to="/login" className="btn btn-secondary w-full mt-8">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 safe-area-top safe-area-bottom">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8 slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 pulse-glow">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-text-primary">
            Create your account
          </h1>
          <p className="mt-2 text-sm md:text-base text-text-secondary">
            Start sending smarter cold emails
          </p>
        </div>

        {/* Signup Form */}
        <form className="space-y-5" onSubmit={handleSignup}>
          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-xl bg-status-bounced/10 border border-status-bounced/20 
                          text-status-bounced text-sm spring-in">
              {error}
            </div>
          )}
          
          {/* Full Name Field */}
          <div className="slide-up" style={{ animationDelay: '50ms' }}>
            <label className="label">Full Name</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>

          {/* Email Field */}
          <div className="slide-up" style={{ animationDelay: '100ms' }}>
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
          <div className="slide-up" style={{ animationDelay: '150ms' }}>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-field pr-12"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            <p className="text-xs text-text-tertiary mt-2">Must be at least 6 characters</p>
          </div>

          {/* Submit Button */}
          <div className="slide-up" style={{ animationDelay: '200ms' }}>
            <button 
              type="submit" 
              disabled={loading} 
              className="btn btn-primary w-full h-12 text-base font-semibold group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Sign up
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Login Link */}
        <p className="mt-8 text-center text-sm text-text-secondary slide-up" style={{ animationDelay: '250ms' }}>
          Already have an account?{' '}
          <Link 
            to="/login" 
            className="text-primary hover:text-primary-dim font-medium transition-colors
                     hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-text-tertiary">
            By signing up, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}
