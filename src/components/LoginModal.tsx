import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  X,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  initialView?: 'login' | 'forgot';
  onClose: () => void;
  onAuthenticate: (
    identifier: string,
    password: string,
  ) => Promise<{ error: string | null; needsAdminSetup?: boolean }>;
  onClaimAdminPassword: (email: string, password: string) => Promise<string | null>;
  onRequestPasswordReset: (email: string) => Promise<string | null>;
  onSwitchToRegister: () => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function LoginModal({
  isOpen,
  initialView = 'login',
  onClose,
  onAuthenticate,
  onClaimAdminPassword,
  onRequestPasswordReset,
  onSwitchToRegister,
}: LoginModalProps) {
  const [view, setView] = useState<'login' | 'forgot'>(initialView);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [showConfirmAdminPass, setShowConfirmAdminPass] = useState(false);
  const [adminSetupMode, setAdminSetupMode] = useState(false);

  // Forgot Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setError(null);
    } else {
      setError(null);
      setAdminSetupMode(false);
      setConfirmAdminPass('');
      setShowPassword(false);
      setShowConfirmAdminPass(false);
      setResetSentTo(null);
      setView('login');
    }
  }, [isOpen, initialView]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  const openForgotPassword = () => {
    setError(null);
    setAdminSetupMode(false);
    setResetSentTo(null);
    if (identifier.includes('@') && !resetEmail) {
      setResetEmail(identifier.trim().toLowerCase());
    }
    setView('forgot');
  };

  const backToLogin = () => {
    setError(null);
    setResetSentTo(null);
    setView('login');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (adminSetupMode) {
        if (password.length < 8) {
          setError('Choose a password with at least 8 characters.');
          return;
        }
        if (password !== confirmAdminPass) {
          setError('Passwords do not match.');
          return;
        }
        const claimErr = await onClaimAdminPassword(identifier, password);
        if (claimErr) {
          setError(claimErr);
          return;
        }
        setIdentifier('');
        setPassword('');
        setConfirmAdminPass('');
        setAdminSetupMode(false);
        return;
      }

      const result = await onAuthenticate(identifier, password);
      if (result.needsAdminSetup) {
        setAdminSetupMode(true);
        setError(result.error);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setIdentifier('');
      setPassword('');
      setConfirmAdminPass('');
      setAdminSetupMode(false);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = resetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError('Enter a valid email address.');
      return;
    }
    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds} seconds before requesting another reset email.`);
      return;
    }

    setLoading(true);
    try {
      const err = await onRequestPasswordReset(normalized);
      if (err) {
        setError(err);
        return;
      }
      setResetSentTo(normalized);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={() => {
            setAdminSetupMode(false);
            setError(null);
            onClose();
          }}
          aria-label="Close authentication modal"
          className="absolute right-4 top-4 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {view === 'forgot' ? (
          <div>
            <div className="mb-6">
              <p className="text-xs font-semibold text-blue-800">E-Finance Rwanda · Password Recovery</p>
              <h2 id="login-modal-title" className="font-display text-2xl font-bold text-[#071B38] mt-1">
                Forgot your password?
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Enter the email address registered on your account to receive a secure password reset link.
              </p>
            </div>

            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-950 leading-relaxed">
              If you usually sign in with your Rwanda phone number, enter the{' '}
              <strong>email address</strong> associated with your E-Finance account.
            </div>

            {resetSentTo && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-950 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                <span>
                  If an account is associated with <strong>{resetSentTo}</strong>, a password reset link has been sent. Please check your inbox and spam folder.
                </span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Registered Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || cooldownSeconds > 0}
                className="w-full h-11 px-5 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Sending Reset Link...'
                    : cooldownSeconds > 0
                      ? `Resend available in ${cooldownSeconds}s`
                      : resetSentTo
                        ? 'Send Another Reset Email'
                        : 'Send Password Reset Email'}
                </span>
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={backToLogin}
                className="font-semibold text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-semibold text-slate-700 hover:text-slate-950 hover:underline"
              >
                Create Account →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <p className="text-xs font-semibold text-blue-800">E-Finance Rwanda</p>
              <h2 id="login-modal-title" className="font-display text-2xl font-bold text-[#071B38] mt-1">
                {adminSetupMode ? 'First-Run Admin Account Setup' : 'Sign in to your account'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {adminSetupMode
                  ? 'Create your Firebase administrator account below.'
                  : 'Enter your registered email address or phone number and password to access your E-Finance workspace.'}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-id" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email Address or Phone Number
                </label>
                <input
                  id="login-id"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (adminSetupMode) setAdminSetupMode(false);
                  }}
                  placeholder="name@example.com or 0788..."
                  required
                  readOnly={adminSetupMode}
                  autoComplete="username"
                  className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-pass" className="block text-xs font-medium text-slate-700">
                    {adminSetupMode ? 'Create Admin Password' : 'Password'}
                  </label>
                  {!adminSetupMode && (
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs font-semibold text-blue-800 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="login-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="w-full h-11 pl-3.5 pr-11 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {adminSetupMode && (
                <div>
                  <label htmlFor="login-pass-confirm" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Confirm Admin Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-pass-confirm"
                      type={showConfirmAdminPass ? 'text' : 'password'}
                      value={confirmAdminPass}
                      onChange={(e) => setConfirmAdminPass(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="w-full h-11 pl-3.5 pr-11 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmAdminPass((prev) => !prev)}
                      aria-label={showConfirmAdminPass ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      {showConfirmAdminPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 px-5 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
              >
                {adminSetupMode && <Lock className="w-4 h-4" />}
                <span>
                  {loading
                    ? 'Verifying...'
                    : adminSetupMode
                      ? 'Create Admin Account'
                      : 'Sign In'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">New to E-Finance Rwanda?</span>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-semibold text-blue-800 hover:underline"
              >
                Create Account →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
