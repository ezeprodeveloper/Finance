import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (
    identifier: string,
    password: string,
  ) => Promise<{ error: string | null; needsAdminSetup?: boolean }>;
  onClaimAdminPassword: (email: string, password: string) => Promise<string | null>;
  onGoogleSignIn?: () => Promise<string | null>;
  onSwitchToRegister: () => void;
}

export function LoginModal({
  isOpen,
  onClose,
  onAuthenticate,
  onClaimAdminPassword,
  onGoogleSignIn,
  onSwitchToRegister,
}: LoginModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [adminSetupMode, setAdminSetupMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setAdminSetupMode(false);
      setConfirmAdminPass('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleGoogleClick = async () => {
    if (!onGoogleSignIn) return;
    setError(null);
    setLoading(true);
    try {
      const err = await onGoogleSignIn();
      if (err) {
        setError(err);
      }
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
          aria-label="Close sign in"
          className="absolute right-4 top-4 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-semibold text-blue-800">E-Finance Rwanda</p>
          <h2 id="login-modal-title" className="font-display text-2xl font-bold text-[#071B38] mt-1">
            {adminSetupMode ? 'First-Run Admin Account Setup' : 'Sign in to your account'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {adminSetupMode
              ? 'Create your Firebase administrator account or sign in with Google below.'
              : 'Enter your registered email or phone number and password to access your E-Finance workspace.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-id" className="block text-xs font-medium text-slate-700 mb-1.5">
              Email address or Phone number
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
              className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              {adminSetupMode ? 'Create Admin Password' : 'Password'}
            </label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          {adminSetupMode && (
            <div>
              <label htmlFor="login-pass-confirm" className="block text-xs font-medium text-slate-700 mb-1.5">
                Confirm Admin Password
              </label>
              <input
                id="login-pass-confirm"
                type="password"
                value={confirmAdminPass}
                onChange={(e) => setConfirmAdminPass(e.target.value)}
                placeholder="Repeat password"
                required
                className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
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

        {onGoogleSignIn && (
          <div className="mt-4">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-slate-400">
                or
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleClick}
              className="w-full h-11 px-4 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">New to E-Finance Rwanda?</span>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-semibold text-blue-800 hover:underline"
          >
            Create 3-step account →
          </button>
        </div>
      </div>
    </div>
  );
}
