import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Upload, X } from 'lucide-react';
import {
  EducationType,
  Gender,
  RegisteredUser,
} from '../types/finance';
import {
  generateAccountNumber,
  generateReferralCode,
  isValidRwandaId,
  isValidRwandaPhone,
  readFileAsDataUrl,
} from '../utils/formatters';
import { RwandaLocationSelector } from './RwandaLocationSelector';

interface RegisterWizardProps {
  isOpen: boolean;
  existingUsers: RegisteredUser[];
  onClose: () => void;
  onComplete: (
    newUser: RegisteredUser,
    rawPassword: string,
    referralCodeInput: string,
  ) => Promise<string | null>;
  onSwitchToLogin: () => void;
}

export function RegisterWizard({
  isOpen,
  existingUsers,
  onClose,
  onComplete,
  onSwitchToLogin,
}: RegisterWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Personal Identification
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoFileName, setPhotoFileName] = useState('');

  // Step 2: Education Background
  const [eduType, setEduType] = useState<EducationType>('University');
  const [institutionName, setInstitutionName] = useState('');
  const [levelOrClass, setLevelOrClass] = useState('');
  const [facultyOrCombination, setFacultyOrCombination] = useState('');

  // Step 3: Place of Birth, Residence, Referral & Password
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [province, setProvince] = useState('');
  const [akarere, setAkarere] = useState('');
  const [umurenge, setUmurenge] = useState('');
  const [akagari, setAkagari] = useState('');
  const [umudugudu, setUmudugudu] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      setReferralCodeInput(refParam.trim().toUpperCase());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file, 3);
      if (dataUrl.length > 450000) {
        setError('Identification photo exceeds 450 KB after compression. Please select a smaller photo.');
        return;
      }
      setPhotoDataUrl(dataUrl);
      setPhotoFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read uploaded photo.');
    }
  };

  const validateStep1 = (): boolean => {
    if (firstName.trim().length < 2 || secondName.trim().length < 2) {
      setError('Enter both your first name and second name.');
      return false;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return false;
    }
    if (existingUsers.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setError('An account with this email already exists.');
      return false;
    }
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!isValidRwandaPhone(phone)) {
      setError('Enter a valid Rwanda phone number (e.g. +250 788 123 456 or 0788123456).');
      return false;
    }
    if (existingUsers.some((u) => u.phone.replace(/[\s-]/g, '') === cleanPhone)) {
      setError('An account with this phone number already exists.');
      return false;
    }
    if (!dateOfBirth) {
      setError('Select your date of birth.');
      return false;
    }
    const cleanId = idNumber.replace(/\s/g, '');
    if (!isValidRwandaId(idNumber)) {
      setError('Enter a valid 16-digit Rwanda National ID number.');
      return false;
    }
    if (existingUsers.some((u) => u.idNumber === cleanId)) {
      setError('An account with this National ID number already exists.');
      return false;
    }
    if (!photoDataUrl) {
      setError('Upload your profile identification photo (cannot be modified by user after submission).');
      return false;
    }
    if (photoDataUrl.length > 450000) {
      setError('Profile identification photo exceeds 450 KB limit. Please upload a smaller image.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (institutionName.trim().length < 2) {
      setError(eduType === 'University' ? 'Enter your university name.' : 'Enter your school name.');
      return false;
    }
    if (levelOrClass.trim().length < 1) {
      setError(eduType === 'University' ? 'Enter your university level.' : 'Enter your A-Level class.');
      return false;
    }
    if (facultyOrCombination.trim().length < 2) {
      setError(
        eduType === 'University' ? 'Enter the faculty you study.' : 'Enter your A-Level combination.',
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (placeOfBirth.trim().length < 2) {
      setError('Enter your place of birth.');
      return;
    }
    if (password.length < 8) {
      setError('Create a login password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const cleanRef = referralCodeInput.trim().toUpperCase();
    const referrer = cleanRef
      ? existingUsers.find((u) => u.referralCode.toUpperCase() === cleanRef)
      : undefined;

    setSubmitting(true);
    try {
      const newUser: RegisteredUser = {
        id: `usr-${Date.now()}`,
        firstName: firstName.trim(),
        secondName: secondName.trim(),
        email: email.trim().toLowerCase(),
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
          province: province.trim() || undefined,
          akarere: akarere.trim() || undefined,
          umurenge: umurenge.trim() || undefined,
          akagari: akagari.trim() || undefined,
          umudugudu: umudugudu.trim() || undefined,
        },
        accountNumber: generateAccountNumber(),
        referralCode: generateReferralCode(firstName.trim()),
        referredByUserId: referrer?.id,
        spinCredits: 0,
        hasCompletedFirstWithdrawal: false,
        accountStatus: 'pending_approval',
        walletBalanceRwf: 0,
        bonusBalanceRwf: 0,
        savingsBalanceRwf: 0,
        walletBalanceUsd: 0,
        usdtBalance: 0,
        usdtSavingsBalance: 0,
        lastCheckInAt: null,
        checkInStreak: 0,
        kycStatus: 'not_submitted',
        createdAt: new Date().toISOString(),
      };
      const regError = await onComplete(newUser, password, cleanRef);
      if (regError) {
        setError(regError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reg-title"
    >
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-2xl my-8">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (!submitting) onClose();
          }}
          aria-label="Close registration"
          className="absolute right-4 top-4 w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-semibold text-blue-800">E-Finance Rwanda Registration · Step {step} of 3</p>
          <h2 id="reg-title" className="font-display text-2xl font-bold text-[#071B38] mt-1">
            {step === 1 && 'Step 1: Personal Identification'}
            {step === 2 && 'Step 2: Education Background'}
            {step === 3 && 'Step 3: Place of Birth, Residence & Password'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            After submitting, E-Finance reviews your registration before you activate your account.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { num: 1, label: '01. Personal ID' },
            { num: 2, label: '02. Education' },
            { num: 3, label: '03. Residence & Password' },
          ].map((item) => (
            <div
              key={item.num}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                step === item.num
                  ? 'bg-[#071B38] text-white border-[#071B38]'
                  : step > item.num
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-fname" className="block text-xs font-medium text-slate-700 mb-1">
                    First Name (F-Name) *
                  </label>
                  <input
                    id="reg-fname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="reg-sname" className="block text-xs font-medium text-slate-700 mb-1">
                    Second Name (S-Name) *
                  </label>
                  <input
                    id="reg-sname"
                    type="text"
                    value={secondName}
                    onChange={(e) => setSecondName(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number (Rwanda) *
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+250 788 000 000"
                    required
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="reg-gender" className="block text-xs font-medium text-slate-700 mb-1">
                    Gender *
                  </label>
                  <select
                    id="reg-gender"
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
                  <label htmlFor="reg-dob" className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    id="reg-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="reg-nid" className="block text-xs font-medium text-slate-700 mb-1">
                    National ID Number (16 digits) *
                  </label>
                  <input
                    id="reg-nid"
                    type="text"
                    maxLength={16}
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="1199XXXXXXXXXXXX"
                    required
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Photo upload - locked after registration */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Identification Photo Upload *</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Once uploaded, this photo is locked on your account and can only be modified by E-Finance Admin.
                    </p>
                  </div>
                  <label className="cursor-pointer h-10 px-4 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-2 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoFileName ? 'Replace before submit' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="sr-only"
                    />
                  </label>
                </div>

                {photoDataUrl && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-3">
                    <img
                      src={photoDataUrl}
                      alt="Uploaded member identification preview"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-300"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-emerald-800 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Photo ready: {photoFileName}</span>
                      </p>
                      <p className="text-slate-500">Locked to profile after submission.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Select your current education track *
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {(['University', 'A-Level'] as const).map((track) => (
                    <button
                      key={track}
                      type="button"
                      onClick={() => {
                        setEduType(track);
                        setError(null);
                      }}
                      className={`h-11 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                        eduType === track
                          ? 'bg-[#071B38] text-white border-[#071B38]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {track}
                    </button>
                  ))}
                </div>
              </div>

              {eduType === 'University' ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edu-uni" className="block text-xs font-medium text-slate-700 mb-1">
                      University Name *
                    </label>
                    <input
                      id="edu-uni"
                      type="text"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder="e.g. University of Rwanda, AUCA, ULK, INES..."
                      required
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edu-level" className="block text-xs font-medium text-slate-700 mb-1">
                        Level *
                      </label>
                      <input
                        id="edu-level"
                        type="text"
                        value={levelOrClass}
                        onChange={(e) => setLevelOrClass(e.target.value)}
                        placeholder="e.g. Year 1, Year 2, Year 3, Year 4, Masters"
                        required
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="edu-faculty" className="block text-xs font-medium text-slate-700 mb-1">
                        Faculty to Study *
                      </label>
                      <input
                        id="edu-faculty"
                        type="text"
                        value={facultyOrCombination}
                        onChange={(e) => setFacultyOrCombination(e.target.value)}
                        placeholder="e.g. Computer Science, Finance, Economics"
                        required
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edu-school" className="block text-xs font-medium text-slate-700 mb-1">
                      School&apos;s Name *
                    </label>
                    <input
                      id="edu-school"
                      type="text"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder="Enter your secondary school name"
                      required
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edu-class" className="block text-xs font-medium text-slate-700 mb-1">
                        Class *
                      </label>
                      <input
                        id="edu-class"
                        type="text"
                        value={levelOrClass}
                        onChange={(e) => setLevelOrClass(e.target.value)}
                        placeholder="e.g. S4, S5, S6"
                        required
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="edu-comb" className="block text-xs font-medium text-slate-700 mb-1">
                        Combination to Study *
                      </label>
                      <input
                        id="edu-comb"
                        type="text"
                        value={facultyOrCombination}
                        onChange={(e) => setFacultyOrCombination(e.target.value)}
                        placeholder="e.g. PCM, MCB, MEG, MPC, HEG"
                        required
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="reg-pob" className="block text-xs font-medium text-slate-700 mb-1">
                  Place of Birth *
                </label>
                <input
                  id="reg-pob"
                  type="text"
                  value={placeOfBirth}
                  onChange={(e) => setPlaceOfBirth(e.target.value)}
                  placeholder="e.g. Kigali, Huye, Musanze, Rubavu..."
                  required
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-800">
                  Current Residence (All 5 Provinces, 30 Districts &amp; 416 Sectors — Optional)
                </p>
                <RwandaLocationSelector
                  province={province}
                  akarere={akarere}
                  umurenge={umurenge}
                  akagari={akagari}
                  umudugudu={umudugudu}
                  onChange={(loc) => {
                    setProvince(loc.province);
                    setAkarere(loc.akarere);
                    setUmurenge(loc.umurenge);
                    setAkagari(loc.akagari);
                    setUmudugudu(loc.umudugudu);
                  }}
                />
              </div>

              <div>
                <label htmlFor="reg-referral" className="block text-xs font-medium text-slate-700 mb-1">
                  Referral Code (Optional)
                </label>
                <input
                  id="reg-referral"
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. EF-RW102"
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700 mb-1">
                    Create Login Password *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="w-full h-10 pl-3 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="w-full h-10 pl-3 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="pt-3 flex items-center justify-between gap-4 border-t border-slate-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((prev) => (prev === 3 ? 2 : 1));
                }}
                className="h-10 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-xs font-semibold text-blue-800 hover:underline"
              >
                Already registered? Log in
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="h-10 px-5 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <span>Continue to Step {step + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <span>{submitting ? 'Creating Account...' : 'Submit Registration'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
