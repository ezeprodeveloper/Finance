import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, ShieldAlert, Upload } from 'lucide-react';
import { firestoreService, type MemberProfileDraft } from '../services/firestoreService';
import type { EducationType, Gender } from '../types/finance';
import { isValidRwandaId, isValidRwandaPhone, readFileAsDataUrl } from '../utils/formatters';

interface ProfileRecoveryViewProps {
  uid: string;
  email: string;
  mode: 'missing' | 'error';
  errorMessage: string | null;
  onRecover: (draft: MemberProfileDraft) => Promise<string | null>;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function ProfileRecoveryView({
  uid,
  email,
  mode,
  errorMessage,
  onRecover,
  onRetry,
  onSignOut,
}: ProfileRecoveryViewProps) {
  const pendingDraft = firestoreService.getPendingProfileDraft();

  const [firstName, setFirstName] = useState(pendingDraft?.firstName ?? '');
  const [secondName, setSecondName] = useState(pendingDraft?.secondName ?? '');
  const [phone, setPhone] = useState(pendingDraft?.phone ?? '');
  const [gender, setGender] = useState<Gender>(pendingDraft?.gender ?? 'Male');
  const [dateOfBirth, setDateOfBirth] = useState(pendingDraft?.dateOfBirth ?? '');
  const [idNumber, setIdNumber] = useState(pendingDraft?.idNumber ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState(pendingDraft?.photoDataUrl ?? '');
  const [photoName, setPhotoName] = useState(pendingDraft?.photoDataUrl ? 'Saved identification photo' : '');
  const [eduType, setEduType] = useState<EducationType>(pendingDraft?.education.type ?? 'University');
  const [institutionName, setInstitutionName] = useState(pendingDraft?.education.institutionName ?? '');
  const [levelOrClass, setLevelOrClass] = useState(pendingDraft?.education.levelOrClass ?? '');
  const [facultyOrCombination, setFacultyOrCombination] = useState(
    pendingDraft?.education.facultyOrCombination ?? '',
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(pendingDraft?.residence.placeOfBirth ?? '');
  const [referralCodeInput, setReferralCodeInput] = useState(pendingDraft?.referralCodeInput ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file, 3);
      if (dataUrl.length > 450000) {
        setLocalError('Photo size still exceeds 450 KB after compression. Please select a smaller image.');
        return;
      }
      setPhotoDataUrl(dataUrl);
      setPhotoName(file.name);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to read image.');
    }
  };

  const handleSyncPendingDraft = async () => {
    if (!pendingDraft) return;
    setLocalError(null);
    setSubmitting(true);
    try {
      const err = await onRecover(pendingDraft);
      if (err) setLocalError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (firstName.trim().length < 2 || secondName.trim().length < 2) {
      setLocalError('Enter both your first name and second name.');
      return;
    }
    if (!isValidRwandaPhone(phone)) {
      setLocalError('Enter a valid Rwanda phone number.');
      return;
    }
    if (!isValidRwandaId(idNumber)) {
      setLocalError('Enter a valid 16-digit Rwanda National ID.');
      return;
    }
    if (!dateOfBirth) {
      setLocalError('Select your date of birth.');
      return;
    }
    if (!photoDataUrl) {
      setLocalError('Upload your profile identification photo.');
      return;
    }
    if (institutionName.trim().length < 2 || levelOrClass.trim().length < 1 || facultyOrCombination.trim().length < 2) {
      setLocalError('Complete your education details.');
      return;
    }
    if (placeOfBirth.trim().length < 2) {
      setLocalError('Enter your place of birth.');
      return;
    }

    setSubmitting(true);
    try {
      const err = await onRecover({
        firstName: firstName.trim(),
        secondName: secondName.trim(),
        email,
        phone: phone.trim(),
        gender,
        dateOfBirth,
        idNumber: idNumber.replace(/\s/g, ''),
        photoDataUrl,
        education: {
          type: eduType,
          institutionName: institutionName.trim(),
          levelOrClass: levelOrClass.trim(),
          facultyOrCombination: facultyOrCombination.trim(),
        },
        residence: {
          placeOfBirth: placeOfBirth.trim(),
          ...(pendingDraft?.residence ?? {}),
        },
        referralCodeInput: referralCodeInput.trim().toUpperCase(),
      });
      if (err) setLocalError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-shifting-aurora flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-7 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-lg font-bold text-[#071B38]">
              Temporarily Unable to Load Profile
            </h1>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your Firebase authentication session for <strong>{email}</strong> is active, but Firestore could not load your profile right now. Your account has not been deleted.
          </p>
          {errorMessage && (
            <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
              {errorMessage}
            </p>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void onRetry()}
              className="flex-1 h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Loading Profile</span>
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="h-10 px-4 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-shifting-aurora flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-2xl my-8 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Account Profile Sync &amp; Recovery</span>
            </p>
            <h1 className="font-display text-xl font-bold text-[#071B38]">
              Complete Your E-Finance Member Profile
            </h1>
            <p className="text-xs text-slate-600">
              Signed in as <strong>{email}</strong> (UID <span className="font-mono">{uid.slice(0, 10)}…</span>). Your authentication account is saved—complete profile persistence in Firestore below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="h-9 px-3 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shrink-0"
          >
            Sign Out
          </button>
        </div>

        {errorMessage && (
          <p className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {errorMessage}
          </p>
        )}

        {pendingDraft && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-emerald-950">
              <p className="font-semibold">Unsynced registration details ready</p>
              <p className="text-emerald-800 mt-0.5">
                Click &ldquo;Sync Saved Profile&rdquo; to finish saving your registration without retyping.
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSyncPendingDraft}
              className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shrink-0 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Syncing...' : 'Sync Saved Profile'}</span>
            </button>
          </div>
        )}

        <form onSubmit={handleManualRecover} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Second Name *</label>
              <input
                type="text"
                value={secondName}
                onChange={(e) => setSecondName(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rwanda Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+250788000000"
                required
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                National ID (16 digits) *
              </label>
              <input
                type="text"
                maxLength={16}
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Place of Birth *</label>
              <input
                type="text"
                value={placeOfBirth}
                onChange={(e) => setPlaceOfBirth(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Track *</label>
              <select
                value={eduType}
                onChange={(e) => setEduType(e.target.value as EducationType)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="University">University</option>
                <option value="A-Level">A-Level</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Institution *</label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Level / Class *</label>
              <input
                type="text"
                value={levelOrClass}
                onChange={(e) => setLevelOrClass(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Faculty / Combination *
              </label>
              <input
                type="text"
                value={facultyOrCombination}
                onChange={(e) => setFacultyOrCombination(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-700">
              <p className="font-semibold">Identification Photo *</p>
              <p className="text-slate-500">{photoName || 'Required for profile creation'}</p>
            </div>
            <label className="cursor-pointer h-9 px-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>{photoDataUrl ? 'Change Photo' : 'Upload Photo'}</span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Referral Code (Optional)
            </label>
            <input
              type="text"
              value={referralCodeInput}
              onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          {localError && (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {localError}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => void onRetry()}
              className="h-10 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Profile Check</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-xs font-semibold rounded-lg"
            >
              {submitting ? 'Saving Profile...' : 'Save & Restore Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
