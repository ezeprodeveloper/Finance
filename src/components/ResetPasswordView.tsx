import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
} from 'lucide-react';
import { firestoreService } from '../services/firestoreService';

interface ResetPasswordViewProps {
  oobCode: string;
  onReturnToLogin: () => void;
  onRequestNewReset: () => void;
}

export function ResetPasswordView({
  oobCode,
  onReturnToLogin,
  onRequestNewReset,
}: ResetPasswordViewProps) {
  const [status, setStatus] = useState<'verifying' | 'ready' | 'invalid' | 'success'>('verifying');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('verifying');
    setError(null);

    if (!oobCode.trim()) {
      setError('Invalid or missing password reset code. Please request a new reset email.');
      setStatus('invalid');
      return;
    }

    void firestoreService
      .verifyResetCode(oobCode)
      .then((email) => {
        if (cancelled) return;
        setVerifiedEmail(email);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'This password reset link is invalid or has expired.',
        );
        setStatus('invalid');
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Choose a new password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await firestoreService.confirmResetPassword(oobCode, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setStatus('success');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reset password. Request a new reset link.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-shifting-aurora flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold text-blue-800">E-Finance Rwanda · Account Security</p>
          <h1 className="font-display text-2xl font-bold text-[#071B38] mt-1">
            {status === 'success' ? 'Password Updated' : 'Set a New Password'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {status === 'verifying' && 'Verifying your Firebase password reset link…'}
            {status === 'ready' &&
              `Create a new password for ${verifiedEmail || 'your E-Finance Rwanda account'}.`}
            {status === 'invalid' && 'We could not validate this password reset link.'}
            {status === 'success' &&
              'Your password has been changed successfully. Sign in with your new password.'}
          </p>
        </div>

        {status === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-[#071B38] rounded-full animate-spin" />
            <p className="text-xs text-slate-600">Checking reset link validity…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs text-red-800 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error || 'This password reset link is invalid or has expired.'}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onRequestNewReset}
                className="flex-1 h-11 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>Request New Reset Link</span>
              </button>
              <button
                type="button"
                onClick={onReturnToLogin}
                className="h-11 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-new-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full h-11 pl-3.5 pr-11 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full h-11 pl-3.5 pr-11 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 px-5 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'Updating Password…' : 'Confirm New Password'}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onReturnToLogin}
                className="text-xs font-semibold text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-900 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>
                Your password for <strong>{verifiedEmail}</strong> has been updated. You can now return to the login screen and sign in using your new password.
              </span>
            </div>
            <button
              type="button"
              onClick={onReturnToLogin}
              className="w-full h-11 px-5 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
            >
              <span>Return to Sign In</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
