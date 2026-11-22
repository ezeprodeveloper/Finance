import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { ADMIN_EMAIL, ADMIN_PASSWORD_SHA256 } from '../data/platformStore';
import { RegisteredUser } from '../types/finance';
import { hashPassword } from '../utils/formatters';

interface LoginModalProps {
  isOpen: boolean;
  users: RegisteredUser[];
  onClose: () => void;
  onLoginUser: (userId: string) => void;
  onLoginAdmin: () => void;
  onSwitchToRegister: () => void;
}

export function LoginModal({
  isOpen,
  users,
  onClose,
  onLoginUser,
  onLoginAdmin,
  onSwitchToRegister,
}: LoginModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanId = identifier.trim().toLowerCase();
      const passHash = await hashPassword(password);

      // Admin authentication
      if (cleanId === ADMIN_EMAIL && passHash === ADMIN_PASSWORD_SHA256) {
        setIdentifier('');
        setPassword('');
        onLoginAdmin();
        return;
      }

      // Member authentication by email or phone
      const matchedUser = users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          u.phone.replace(/\s+/g, '') === identifier.trim().replace(/\s+/g, ''),
      );

      if (!matchedUser || matchedUser.passwordHash !== passHash) {
        setError('Invalid email/phone or password.');
        return;
      }

      if (matchedUser.accountStatus === 'suspended') {
        setError('This account has been suspended by E-Finance Admin.');
        return;
      }

      setIdentifier('');
      setPassword('');
      onLoginUser(matchedUser.id);
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
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute right-4 top-4 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-semibold text-blue-800">E-Finance Rwanda</p>
          <h2 id="login-modal-title" className="font-display text-2xl font-bold text-[#071B38] mt-1">
            Sign in to your account
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Enter your registered email or phone number and password to access your E-Finance workspace.
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
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              Password
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

          {error && (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 px-5 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
          >
            <span>{loading ? 'Verifying...' : 'Sign In'}</span>
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
            Create 3-step account →
          </button>
        </div>
      </div>
    </div>
  );
}
