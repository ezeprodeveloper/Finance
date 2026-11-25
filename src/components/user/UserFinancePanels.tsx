import React, { useMemo, useState } from 'react';
import { ShieldAlert, Upload } from 'lucide-react';
import {
  LoanRequest,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  SystemSettings,
  WithdrawalRequest,
} from '../../types/finance';
import {
  formatRwf,
  formatShortDate,
  isValidRwandaId,
  isValidRwandaPhone,
  readFileAsDataUrl,
} from '../../utils/formatters';
import { RwandaLocationSelector } from '../RwandaLocationSelector';
import { StatusLabel } from '../StatusLabel';

/* -------------------------------------------------------------------------- */
/* 1. Rwanda KYC Verification View                                            */
/* -------------------------------------------------------------------------- */

interface UserKycViewProps {
  user: RegisteredUser;
  onSubmitKyc: (data: RwandaKycData) => void;
}

export function UserKycView({ user, onSubmitKyc }: UserKycViewProps) {
  const [nationalId, setNationalId] = useState(user.kycData?.nationalId ?? user.idNumber);
  const [idIssueDistrict, setIdIssueDistrict] = useState(user.kycData?.idIssueDistrict ?? '');
  const [province, setProvince] = useState(user.kycData?.province ?? 'Kigali City');
  const [akarere, setAkarere] = useState(user.kycData?.akarere ?? user.residence.akarere ?? '');
  const [umurenge, setUmurenge] = useState(user.kycData?.umurenge ?? user.residence.umurenge ?? '');
  const [akagari, setAkagari] = useState(user.kycData?.akagari ?? user.residence.akagari ?? '');
  const [umudugudu, setUmudugudu] = useState(user.kycData?.umudugudu ?? user.residence.umudugudu ?? '');
  const [occupation, setOccupation] = useState(user.kycData?.occupation ?? '');
  const [nextOfKinName, setNextOfKinName] = useState(user.kycData?.nextOfKinName ?? '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(user.kycData?.nextOfKinPhone ?? '');
  const [docPhoto, setDocPhoto] = useState(user.kycData?.idDocumentPhotoDataUrl ?? '');
  const [selfiePhoto, setSelfiePhoto] = useState(user.kycData?.selfiePhotoDataUrl ?? '');
  const [docName, setDocName] = useState('');
  const [selfieName, setSelfieName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
    nameSetter: (val: string) => void,
  ) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Upload a valid image file (JPG, PNG, WebP).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file, 3);
      setter(dataUrl);
      nameSetter(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read image.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidRwandaId(nationalId)) {
      setError('Enter a valid 16-digit Rwanda National ID.');
      return;
    }
    if (!akarere || !umurenge || !akagari || !umudugudu) {
      setError('Select Akarere, Umurenge, Akagari, and Umudugudu for Rwanda KYC.');
      return;
    }
    if (!isValidRwandaPhone(nextOfKinPhone)) {
      setError('Enter a valid Rwanda phone number for Next of Kin.');
      return;
    }
    if (!docPhoto || !selfiePhoto) {
      setError('Upload both your Rwanda National ID photo and selfie verification proof.');
      return;
    }

    onSubmitKyc({
      nationalId: nationalId.replace(/\s/g, ''),
      idIssueDistrict: idIssueDistrict.trim(),
      province,
      akarere,
      umurenge,
      akagari,
      umudugudu,
      occupation: occupation.trim(),
      nextOfKinName: nextOfKinName.trim(),
      nextOfKinPhone: nextOfKinPhone.trim(),
      idDocumentPhotoDataUrl: docPhoto,
      selfiePhotoDataUrl: selfiePhoto,
      submittedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="bg-white/95 border border-slate-200 rounded-xl p-6 max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Rwanda KYC Verification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Required before making Savings deposits or Mobile Money Withdrawals.
          </p>
        </div>
        <StatusLabel
          label={
            user.kycStatus === 'approved'
              ? 'VERIFIED'
              : user.kycStatus === 'pending'
                ? 'PENDING'
                : user.kycStatus === 'rejected'
                  ? 'REJECTED'
                  : 'UNVERIFIED'
          }
          tone={
            user.kycStatus === 'approved'
              ? 'success'
              : user.kycStatus === 'pending'
                ? 'warning'
                : user.kycStatus === 'rejected'
                  ? 'danger'
                  : 'neutral'
          }
        />
      </div>

      {user.kycData?.reviewNote && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <strong>Review Note:</strong> {user.kycData.reviewNote}
        </div>
      )}

      {user.kycStatus === 'approved' ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p className="text-emerald-800 font-medium">
            Your Rwanda KYC is verified. Saving Money and Withdrawals are unlocked on your account.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
            <div>
              <span className="text-slate-500 block">National ID</span>
              <span className="font-mono font-semibold text-slate-900">{user.kycData?.nationalId}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Location</span>
              <span className="font-semibold text-slate-900">
                {user.kycData?.akarere} / {user.kycData?.umurenge}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Cell / Village</span>
              <span className="font-semibold text-slate-900">
                {user.kycData?.akagari} / {user.kycData?.umudugudu}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="kyc-nid" className="block text-xs font-medium text-slate-700 mb-1">
                Rwanda National ID (16 digits) *
              </label>
              <input
                id="kyc-nid"
                type="text"
                maxLength={16}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="kyc-issue" className="block text-xs font-medium text-slate-700 mb-1">
                Place / District of ID Issue *
              </label>
              <input
                id="kyc-issue"
                type="text"
                value={idIssueDistrict}
                onChange={(e) => setIdIssueDistrict(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="kyc-prov" className="block text-xs font-medium text-slate-700 mb-1">
                Province *
              </label>
              <select
                id="kyc-prov"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="Kigali City">Kigali City</option>
                <option value="Northern Province">Northern Province</option>
                <option value="Southern Province">Southern Province</option>
                <option value="Eastern Province">Eastern Province</option>
                <option value="Western Province">Western Province</option>
              </select>
            </div>
            <div>
              <label htmlFor="kyc-occ" className="block text-xs font-medium text-slate-700 mb-1">
                Occupation / Source of Income *
              </label>
              <input
                id="kyc-occ"
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <RwandaLocationSelector
            province={province}
            akarere={akarere}
            umurenge={umurenge}
            akagari={akagari}
            umudugudu={umudugudu}
            required
            onChange={(loc) => {
              setProvince(loc.province);
              setAkarere(loc.akarere);
              setUmurenge(loc.umurenge);
              setAkagari(loc.akagari);
              setUmudugudu(loc.umudugudu);
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="kyc-nok-name" className="block text-xs font-medium text-slate-700 mb-1">
                Next of Kin Full Name *
              </label>
              <input
                id="kyc-nok-name"
                type="text"
                value={nextOfKinName}
                onChange={(e) => setNextOfKinName(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="kyc-nok-phone" className="block text-xs font-medium text-slate-700 mb-1">
                Next of Kin Phone *
              </label>
              <input
                id="kyc-nok-phone"
                type="tel"
                value={nextOfKinPhone}
                onChange={(e) => setNextOfKinPhone(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">National ID Card Photo *</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {docName || (docPhoto ? 'Uploaded' : 'Front/Back ID image')}
                </p>
              </div>
              <label className="cursor-pointer h-9 px-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhoto(e, setDocPhoto, setDocName)}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Selfie Verification Proof *</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {selfieName || (selfiePhoto ? 'Uploaded' : 'Clear selfie with ID')}
                </p>
              </div>
              <label className="cursor-pointer h-9 px-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhoto(e, setSelfiePhoto, setSelfieName)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={user.kycStatus === 'pending'}
            className="h-10 px-5 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            {user.kycStatus === 'pending' ? 'KYC Pending Review' : 'Submit Rwanda KYC'}
          </button>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Savings View (KYC Required)                                             */
/* -------------------------------------------------------------------------- */

interface UserSavingsViewProps {
  user: RegisteredUser;
  goals: SavingsGoal[];
  onGoToKyc: () => void;
  onCreateGoal: (title: string, planType: SavingsGoal['planType'], targetRwf: number, targetDate: string) => void;
  onDepositToSavings: (goalId: string, amountRwf: number) => void;
  onWithdrawFromSavings: (goalId: string, amountRwf: number) => void;
}

export function UserSavingsView({
  user,
  goals,
  onGoToKyc,
  onCreateGoal,
  onDepositToSavings,
  onWithdrawFromSavings,
}: UserSavingsViewProps) {
  const [title, setTitle] = useState('');
  const [planType, setPlanType] = useState<SavingsGoal['planType']>('Flexible');
  const [target, setTarget] = useState('50000');
  const [targetDate, setTargetDate] = useState('2027-06-30');
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0]?.id ?? '');
  const [moveAmount, setMoveAmount] = useState('500');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (user.kycStatus !== 'approved') {
    return (
      <div className="bg-white/95 border border-slate-200 rounded-xl p-6 max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Rwanda KYC required for Savings</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Before you can save funds in E-Finance Rwanda, you must submit your full Rwanda KYC details and receive verification approval.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToKyc}
          className="h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg"
        >
          Complete Rwanda KYC Now
        </button>
      </div>
    );
  }

  const activeGoalId = goals.some((g) => g.id === selectedGoalId) ? selectedGoalId : goals[0]?.id ?? '';

  return (
    <div className="space-y-6">
      <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs text-slate-500">Available Wallet Balance</p>
          <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
            {formatRwf(user.walletBalanceRwf)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Total Saved Balance</p>
          <p className="font-mono text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">
            {formatRwf(user.savingsBalanceRwf)}
          </p>
        </div>
      </div>

      {notice && (
        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl divide-y divide-slate-200">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Your savings plans</h2>
          </div>
          {goals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Create your first savings plan to begin saving RWF anytime.
            </div>
          ) : (
            goals.map((g) => {
              const pct = Math.min(100, Math.round((g.currentRwf / Math.max(1, g.targetRwf)) * 100));
              return (
                <div key={g.id} className="p-5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
                      <p className="text-xs text-slate-500">
                        {g.planType} · Target {formatShortDate(g.targetDate)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGoalId(g.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md border ${
                        activeGoalId === g.id
                          ? 'bg-[#071B38] text-white border-[#071B38]'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Select
                    </button>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span>{formatRwf(g.currentRwf)} saved</span>
                    <span className="text-slate-500">
                      {pct}% of {formatRwf(g.targetRwf)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <div className="lg:col-span-5 space-y-6">
          {goals.length > 0 && (
            <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Save or retrieve anytime</h2>
              <div>
                <label htmlFor="sav-move-amt" className="block text-xs font-medium text-slate-700 mb-1">
                  Amount (RWF)
                </label>
                <input
                  id="sav-move-amt"
                  type="number"
                  min={50}
                  value={moveAmount}
                  onChange={(e) => setMoveAmount(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    const amt = Number(moveAmount);
                    if (!Number.isFinite(amt) || amt < 50) {
                      setError('Enter at least 50 RWF.');
                      return;
                    }
                    if (amt > user.walletBalanceRwf) {
                      setError('Insufficient wallet balance.');
                      return;
                    }
                    onDepositToSavings(activeGoalId, Math.round(amt));
                    setNotice(`Saved ${formatRwf(amt)} from your wallet.`);
                  }}
                  className="h-10 px-3 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg"
                >
                  Save to Plan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    const amt = Number(moveAmount);
                    const targetGoal = goals.find((g) => g.id === activeGoalId);
                    if (!targetGoal || !Number.isFinite(amt) || amt < 50) {
                      setError('Enter a valid amount.');
                      return;
                    }
                    if (amt > targetGoal.currentRwf) {
                      setError('Amount exceeds plan saved balance.');
                      return;
                    }
                    onWithdrawFromSavings(activeGoalId, Math.round(amt));
                    setNotice(`Moved ${formatRwf(amt)} back to wallet balance.`);
                  }}
                  className="h-10 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
                >
                  Move to Wallet
                </button>
              </div>
            </section>
          )}

          <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-3.5">
            <h2 className="text-base font-semibold text-slate-900">Create savings plan</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (title.trim().length < 2) {
                  setError('Enter a plan title.');
                  return;
                }
                onCreateGoal(title.trim(), planType, Math.max(1000, Number(target) || 1000), targetDate);
                setTitle('');
                setNotice('Savings plan created.');
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Savings plan name"
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as SavingsGoal['planType'])}
                  className="h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="Flexible">Flexible</option>
                  <option value="Goal-Based">Goal-Based</option>
                  <option value="Long-Term">Long-Term</option>
                </select>
                <input
                  type="number"
                  min={1000}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <button
                type="submit"
                className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
              >
                Create Plan
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Loans / Request Money View                                              */
/* -------------------------------------------------------------------------- */

interface UserLoansViewProps {
  user: RegisteredUser;
  loans: LoanRequest[];
  onGoToSavings?: () => void;
  onRequestLoan: (payload: {
    product: string;
    reason: string;
    principalRwf: number;
    termMonths: number;
    annualRatePercent: number;
    monthlyPaymentRwf: number;
    totalRepayableRwf: number;
  }) => void;
  onRepayLoan: (loanId: string, amountRwf: number) => void;
}

export function UserLoansView({
  user,
  loans,
  onGoToSavings,
  onRequestLoan,
  onRepayLoan,
}: UserLoansViewProps) {
  const [product, setProduct] = useState('Personal Emergency Credit');
  const [principal, setPrincipal] = useState('10000');
  const [termMonths, setTermMonths] = useState(3);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const annualRate = 12;
  const principalNum = Math.max(1000, Number(principal) || 1000);
  const meetsSavingsRequirement = user.savingsBalanceRwf > principalNum;

  const calc = useMemo(() => {
    const totalRepayable = Math.round(principalNum * (1 + (annualRate / 100) * (termMonths / 12)));
    const monthly = Math.round(totalRepayable / termMonths);
    return { totalRepayable, monthly };
  }, [principalNum, termMonths]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (user.savingsBalanceRwf <= principalNum) {
      setError(
        `Your Savings Vault balance (${formatRwf(user.savingsBalanceRwf)}) must be strictly greater than your requested loan amount (${formatRwf(principalNum)}).`,
      );
      return;
    }
    if (reason.trim().length < 5) {
      setError('State the purpose of your loan request.');
      return;
    }
    onRequestLoan({
      product,
      reason: reason.trim(),
      principalRwf: Math.round(principalNum),
      termMonths,
      annualRatePercent: annualRate,
      monthlyPaymentRwf: calc.monthly,
      totalRepayableRwf: calc.totalRepayable,
    });
    setReason('');
    setNotice(
      `Submitted request for ${formatRwf(principalNum)}. E-Finance will review and disburse to your balance.`,
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
          Request / Borrow money from E-Finance
        </h2>
        <div
          className={`mt-4 px-3.5 py-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            meetsSavingsRequirement
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div>
            <span className="font-semibold">Eligibility Rule:</span> Your Savings Vault balance (
            <strong className="font-mono tabular-nums">{formatRwf(user.savingsBalanceRwf)}</strong>) must be greater than your requested loan.
          </div>
          {!meetsSavingsRequirement && onGoToSavings && (
            <button
              type="button"
              onClick={onGoToSavings}
              className="font-semibold text-blue-800 hover:underline shrink-0"
            >
              Go to Save Money →
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="ln-prod" className="block text-xs font-medium text-slate-700 mb-1">
              Loan category
            </label>
            <select
              id="ln-prod"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="Personal Emergency Credit">Personal Emergency Credit (12% APR)</option>
              <option value="Student Support Credit">Student Support Credit (12% APR)</option>
              <option value="Business Working Capital">Business Working Capital (12% APR)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ln-amt" className="block text-xs font-medium text-slate-700 mb-1">
                Amount needed (RWF)
              </label>
              <input
                id="ln-amt"
                type="number"
                min={1000}
                step={500}
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="ln-term" className="block text-xs font-medium text-slate-700 mb-1">
                Term (Months)
              </label>
              <select
                id="ln-term"
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                {[1, 2, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} month{m > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ln-reason" className="block text-xs font-medium text-slate-700 mb-1">
              Purpose / Reason *
            </label>
            <textarea
              id="ln-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Est. Monthly</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatRwf(calc.monthly)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Repayable</span>
              <span className="font-mono font-semibold text-[#071B38] tabular-nums">
                {formatRwf(calc.totalRepayable)}
              </span>
            </div>
          </div>

          {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
          {notice && <p className="text-xs text-emerald-700 font-medium">{notice}</p>}

          <button
            type="submit"
            disabled={!meetsSavingsRequirement}
            className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-45 text-white text-sm font-semibold rounded-lg"
          >
            {meetsSavingsRequirement
              ? 'Submit Loan Request'
              : 'Increase Savings Above Requested Loan'}
          </button>
        </form>
      </section>

      <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Your loan requests &amp; repayments</h2>
        </div>
        {loans.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No loan requests submitted yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {loans.map((ln) => {
              const remaining = Math.max(0, ln.totalRepayableRwf - ln.repaidRwf);
              return (
                <div key={ln.id} className="p-5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{ln.product}</h3>
                      <p className="text-xs text-slate-500">
                        {ln.termMonths} mo · Requested {formatShortDate(ln.createdAt)}
                      </p>
                    </div>
                    <StatusLabel
                      label={
                        ln.status === 'approved'
                          ? 'Disbursed'
                          : ln.status === 'repaid'
                            ? 'Repaid'
                            : ln.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending Review'
                      }
                      tone={
                        ln.status === 'approved' || ln.status === 'repaid'
                          ? 'success'
                          : ln.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-slate-500 block font-sans">Principal</span>
                      <span>{formatRwf(ln.principalRwf)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Repaid</span>
                      <span>{formatRwf(ln.repaidRwf)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Remaining</span>
                      <span className="font-semibold text-[#071B38]">{formatRwf(remaining)}</span>
                    </div>
                  </div>
                  {ln.status === 'approved' && remaining > 0 && (
                    <button
                      type="button"
                      disabled={user.walletBalanceRwf <= 0}
                      onClick={() => {
                        const payAmt = Math.min(remaining, user.walletBalanceRwf, ln.monthlyPaymentRwf);
                        if (payAmt > 0) {
                          onRepayLoan(ln.id, payAmt);
                          setNotice(`Repaid ${formatRwf(payAmt)} toward ${ln.product}.`);
                        }
                      }}
                      className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold rounded-md"
                    >
                      Repay {formatRwf(Math.min(remaining, Math.max(0, user.walletBalanceRwf), ln.monthlyPaymentRwf))} from Wallet
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Withdrawals View (KYC Required + First 25% Bonus Fee + 1k-5k Limits)    */
/* -------------------------------------------------------------------------- */

interface UserWithdrawalsViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  withdrawals: WithdrawalRequest[];
  onGoToKyc: () => void;
  onRequestWithdrawal: (payload: {
    network: 'MTN Rwanda' | 'Airtel / Tigo Rwanda';
    destinationType: 'Phone Number' | 'MoMo Pay Code';
    destinationValue: string;
    accountRegisteredNames: string;
    grossAmountRwf: number;
    feePercent: number;
    feeRwf: number;
    netAmountRwf: number;
    isFirstBonusWithdrawal: boolean;
  }) => void;
}

export function UserWithdrawalsView({
  user,
  settings,
  withdrawals,
  onGoToKyc,
  onRequestWithdrawal,
}: UserWithdrawalsViewProps) {
  const isFirstBonusWithdrawal = !user.hasCompletedFirstWithdrawal;

  const [network, setNetwork] = useState<'MTN Rwanda' | 'Airtel / Tigo Rwanda'>('MTN Rwanda');
  const [destinationType, setDestinationType] = useState<'Phone Number' | 'MoMo Pay Code'>('Phone Number');
  const [destinationValue, setDestinationValue] = useState(user.phone);
  const [registeredNames, setRegisteredNames] = useState(`${user.firstName} ${user.secondName}`);
  const [amount, setAmount] = useState(
    isFirstBonusWithdrawal ? String(settings.welcomeBonusRwf) : String(settings.subsequentMinWithdrawalRwf),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (user.kycStatus !== 'approved') {
    return (
      <div className="bg-white/95 border border-slate-200 rounded-xl p-6 max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Rwanda KYC required before withdrawing</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Submit your Rwanda KYC details and receive verification approval before requesting a Mobile Money withdrawal.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToKyc}
          className="h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg"
        >
          Complete Rwanda KYC Now
        </button>
      </div>
    );
  }

  const gross = Math.max(0, Math.round(Number(amount) || 0));
  const appliedFeePercent = isFirstBonusWithdrawal ? settings.withdrawalFeePercent : 0;
  const feeRwf = Math.round((gross * appliedFeePercent) / 100);
  const netRwf = Math.max(0, gross - feeRwf);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (network === 'Airtel / Tigo Rwanda' || destinationType === 'Phone Number') {
      if (!isValidRwandaPhone(destinationValue)) {
        setError('Enter a valid Rwanda mobile phone number (078/079/072/073).');
        return;
      }
    } else if (destinationValue.trim().length < 4) {
      setError('Enter a valid MTN MoMo Pay Code.');
      return;
    }

    if (registeredNames.trim().length < 3) {
      setError('Enter the registered Mobile Money account names.');
      return;
    }

    if (isFirstBonusWithdrawal) {
      if (gross < 100) {
        setError('First bonus withdrawal minimum is 100 RWF.');
        return;
      }
    } else {
      if (gross < settings.subsequentMinWithdrawalRwf) {
        setError(
          `Minimum withdrawal is ${formatRwf(settings.subsequentMinWithdrawalRwf)}.`,
        );
        return;
      }
      if (gross > settings.subsequentMaxWithdrawalRwf) {
        setError(
          `Maximum withdrawal per transaction is ${formatRwf(settings.subsequentMaxWithdrawalRwf)}.`,
        );
        return;
      }
    }

    if (gross > user.walletBalanceRwf) {
      setError(`Insufficient balance (${formatRwf(user.walletBalanceRwf)} available).`);
      return;
    }

    onRequestWithdrawal({
      network,
      destinationType: network === 'Airtel / Tigo Rwanda' ? 'Phone Number' : destinationType,
      destinationValue: destinationValue.trim(),
      accountRegisteredNames: registeredNames.trim(),
      grossAmountRwf: gross,
      feePercent: appliedFeePercent,
      feeRwf,
      netAmountRwf: netRwf,
      isFirstBonusWithdrawal,
    });
    setNotice(
      `Withdrawal submitted for ${formatRwf(gross)} via ${network} (${destinationValue.trim()}). Net payout: ${formatRwf(netRwf)}.`,
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-xl p-6">
        <div className="pb-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Withdraw to Mobile Money</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Available balance:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">{formatRwf(user.walletBalanceRwf)}</strong>
          </p>
        </div>

        <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          {isFirstBonusWithdrawal ? (
            <span>
              <strong>First Withdrawal (Welcome Bonus):</strong> A {settings.withdrawalFeePercent}% fee applies automatically. Subsequent withdrawals allow{' '}
              {formatRwf(settings.subsequentMinWithdrawalRwf)} – {formatRwf(settings.subsequentMaxWithdrawalRwf)}.
            </span>
          ) : (
            <span>
              <strong>Standard Withdrawal Limits:</strong> Minimum {formatRwf(settings.subsequentMinWithdrawalRwf)} · Maximum{' '}
              {formatRwf(settings.subsequentMaxWithdrawalRwf)} per transaction.
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">Rwanda Network *</span>
            <div className="grid grid-cols-2 gap-2">
              {(['MTN Rwanda', 'Airtel / Tigo Rwanda'] as const).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => {
                    setNetwork(net);
                    if (net === 'Airtel / Tigo Rwanda') setDestinationType('Phone Number');
                  }}
                  className={`h-10 px-3 text-xs font-semibold rounded-lg border ${
                    network === net
                      ? 'bg-[#071B38] text-white border-[#071B38]'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>

          {network === 'MTN Rwanda' && (
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1.5">MTN Payout Destination *</span>
              <div className="grid grid-cols-2 gap-2">
                {(['Phone Number', 'MoMo Pay Code'] as const).map((dtype) => (
                  <button
                    key={dtype}
                    type="button"
                    onClick={() => {
                      setDestinationType(dtype);
                      setDestinationValue(dtype === 'Phone Number' ? user.phone : '');
                    }}
                    className={`h-9 px-3 text-xs font-semibold rounded-lg border ${
                      destinationType === dtype
                        ? 'bg-blue-800 text-white border-blue-800'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {dtype}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="wd-dest" className="block text-xs font-medium text-slate-700 mb-1">
              {network === 'MTN Rwanda' && destinationType === 'MoMo Pay Code'
                ? 'MTN MoMo Pay Code *'
                : `${network} Phone Number *`}
            </label>
            <input
              id="wd-dest"
              type="text"
              value={destinationValue}
              onChange={(e) => setDestinationValue(e.target.value)}
              placeholder={
                network === 'MTN Rwanda' && destinationType === 'MoMo Pay Code'
                  ? 'e.g. 1880554'
                  : '+250 788 000 000'
              }
              required
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="wd-names" className="block text-xs font-medium text-slate-700 mb-1">
              Registered Account Names *
            </label>
            <input
              id="wd-names"
              type="text"
              value={registeredNames}
              onChange={(e) => setRegisteredNames(e.target.value)}
              placeholder="Exact names registered on Mobile Money"
              required
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="wd-amt" className="block text-xs font-medium text-slate-700 mb-1">
              Withdrawal amount (RWF) *
            </label>
            <input
              id="wd-amt"
              type="number"
              min={isFirstBonusWithdrawal ? 100 : settings.subsequentMinWithdrawalRwf}
              max={isFirstBonusWithdrawal ? undefined : settings.subsequentMaxWithdrawalRwf}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Deducted from wallet</span>
              <span className="font-mono tabular-nums">{formatRwf(gross)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>
                {isFirstBonusWithdrawal
                  ? `First Bonus Withdrawal Fee (${settings.withdrawalFeePercent}%)`
                  : 'Standard Withdrawal Fee (0%)'}
              </span>
              <span className="font-mono tabular-nums">-{formatRwf(feeRwf)}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-800 pt-1.5 border-t border-slate-200">
              <span>Net Mobile Money Payout</span>
              <span className="font-mono tabular-nums">{formatRwf(netRwf)}</span>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-700">{error}</p>}
          {notice && <p className="text-xs font-medium text-emerald-700">{notice}</p>}

          <button
            type="submit"
            className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
          >
            Request Withdrawal
          </button>
        </form>
      </section>

      <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Your withdrawal requests</h2>
        </div>
        {withdrawals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No withdrawal requests yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {withdrawals.map((wd) => (
              <div key={wd.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {wd.network} · {wd.destinationType}: {wd.destinationValue}
                  </p>
                  <p className="text-xs text-slate-600">Names: {wd.accountRegisteredNames}</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                    Gross {formatRwf(wd.grossAmountRwf)} · Fee ({wd.feePercent}%) {formatRwf(wd.feeRwf)} · Net{' '}
                    {formatRwf(wd.netAmountRwf)}
                  </p>
                </div>
                <StatusLabel
                  label={wd.status === 'paid' ? 'Paid' : wd.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                  tone={wd.status === 'paid' ? 'success' : wd.status === 'rejected' ? 'danger' : 'warning'}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
