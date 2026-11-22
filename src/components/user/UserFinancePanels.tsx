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
  const [docName, setDocName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Upload an image of your Rwanda National ID.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file, 3);
      setDocPhoto(dataUrl);
      setDocName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ID photo.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidRwandaId(nationalId)) {
      setError('Enter a valid 16-digit Rwanda National ID.');
      return;
    }
    if (!akarere.trim() || !umurenge.trim() || !akagari.trim() || !umudugudu.trim()) {
      setError('Complete Akarere, Umurenge, Akagari, and Umudugudu for Rwanda KYC.');
      return;
    }
    if (!isValidRwandaPhone(nextOfKinPhone)) {
      setError('Enter a valid Rwanda phone number for Next of Kin.');
      return;
    }
    if (!docPhoto) {
      setError('Upload your Rwanda National ID verification photo.');
      return;
    }

    onSubmitKyc({
      nationalId: nationalId.replace(/\s/g, ''),
      idIssueDistrict: idIssueDistrict.trim(),
      province,
      akarere: akarere.trim(),
      umurenge: umurenge.trim(),
      akagari: akagari.trim(),
      umudugudu: umudugudu.trim(),
      occupation: occupation.trim(),
      nextOfKinName: nextOfKinName.trim(),
      nextOfKinPhone: nextOfKinPhone.trim(),
      idDocumentPhotoDataUrl: docPhoto,
      submittedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl space-y-5">
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
              ? 'KYC Approved'
              : user.kycStatus === 'pending'
                ? 'Pending Admin Review'
                : user.kycStatus === 'rejected'
                  ? 'Rejected — Update & Resubmit'
                  : 'Not Submitted'
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
          <strong>Admin Review Note:</strong> {user.kycData.reviewNote}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label htmlFor="kyc-akarere" className="block text-xs font-medium text-slate-700 mb-1">
                Akarere (District) *
              </label>
              <input
                id="kyc-akarere"
                type="text"
                value={akarere}
                onChange={(e) => setAkarere(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="kyc-umurenge" className="block text-xs font-medium text-slate-700 mb-1">
                Umurenge (Sector) *
              </label>
              <input
                id="kyc-umurenge"
                type="text"
                value={umurenge}
                onChange={(e) => setUmurenge(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="kyc-akagari" className="block text-xs font-medium text-slate-700 mb-1">
                Akagari (Cell) *
              </label>
              <input
                id="kyc-akagari"
                type="text"
                value={akagari}
                onChange={(e) => setAkagari(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="kyc-umudugudu" className="block text-xs font-medium text-slate-700 mb-1">
                Umudugudu (Village) *
              </label>
              <input
                id="kyc-umudugudu"
                type="text"
                value={umudugudu}
                onChange={(e) => setUmudugudu(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
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

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-900">National ID Card Photo Upload *</p>
              <p className="text-xs text-slate-500">
                {docName ? `Loaded: ${docName}` : 'Upload clear photo of your Rwanda National ID.'}
              </p>
            </div>
            <label className="cursor-pointer h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>{docPhoto ? 'Replace ID Photo' : 'Upload ID Photo'}</span>
              <input type="file" accept="image/*" onChange={handleDocUpload} className="sr-only" />
            </label>
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
            {user.kycStatus === 'pending' ? 'KYC Pending Admin Review' : 'Submit Rwanda KYC'}
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Rwanda KYC required for Savings</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Before you can save funds in E-Finance Rwanda, you must submit your full Rwanda KYC details and receive Admin approval.
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
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
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
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
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
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
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

          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3.5">
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

  const calc = useMemo(() => {
    const totalRepayable = Math.round(principalNum * (1 + (annualRate / 100) * (termMonths / 12)));
    const monthly = Math.round(totalRepayable / termMonths);
    return { totalRepayable, monthly };
  }, [principalNum, termMonths]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      `Submitted request for ${formatRwf(principalNum)}. E-Finance Admin will review and disburse to your balance.`,
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
          Request / Borrow money from E-Finance
        </h2>
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
            className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
          >
            Submit Loan Request
          </button>
        </form>
      </section>

      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
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
                              : 'Pending Admin'
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
/* 4. Withdrawals View (KYC Required + 25% System Fee)                        */
/* -------------------------------------------------------------------------- */

interface UserWithdrawalsViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  withdrawals: WithdrawalRequest[];
  onGoToKyc: () => void;
  onRequestWithdrawal: (payload: {
    provider: 'MTN Mobile Money' | 'Airtel Money';
    phone: string;
    grossAmountRwf: number;
    feePercent: number;
    feeRwf: number;
    netAmountRwf: number;
  }) => void;
}

export function UserWithdrawalsView({
  user,
  settings,
  withdrawals,
  onGoToKyc,
  onRequestWithdrawal,
}: UserWithdrawalsViewProps) {
  const [provider, setProvider] = useState<'MTN Mobile Money' | 'Airtel Money'>('MTN Mobile Money');
  const [phone, setPhone] = useState(user.phone);
  const [amount, setAmount] = useState('200');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (user.kycStatus !== 'approved') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Rwanda KYC required before withdrawing</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Submit your Rwanda KYC details and wait for Admin approval before requesting a Mobile Money withdrawal.
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
  const feeRwf = Math.round((gross * settings.withdrawalFeePercent) / 100);
  const netRwf = Math.max(0, gross - feeRwf);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!isValidRwandaPhone(phone)) {
      setError('Enter a valid Rwanda Mobile Money phone number.');
      return;
    }
    if (gross < 100) {
      setError('Minimum withdrawal request is 100 RWF.');
      return;
    }
    if (gross > user.walletBalanceRwf) {
      setError(`Insufficient balance (${formatRwf(user.walletBalanceRwf)} available).`);
      return;
    }

    onRequestWithdrawal({
      provider,
      phone: phone.trim(),
      grossAmountRwf: gross,
      feePercent: settings.withdrawalFeePercent,
      feeRwf,
      netAmountRwf: netRwf,
    });
    setNotice(
      `Withdrawal submitted for ${formatRwf(gross)} (${settings.withdrawalFeePercent}% fee = ${formatRwf(feeRwf)}, Net payout = ${formatRwf(netRwf)}).`,
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Withdraw to Mobile Money</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Available balance:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">{formatRwf(user.walletBalanceRwf)}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['MTN Mobile Money', 'Airtel Money'] as const).map((net) => (
              <button
                key={net}
                type="button"
                onClick={() => setProvider(net)}
                className={`h-10 px-3 text-xs font-semibold rounded-lg border ${
                  provider === net
                    ? 'bg-[#071B38] text-white border-[#071B38]'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {net}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="wd-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Recipient Phone *
            </label>
            <input
              id="wd-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="wd-amt" className="block text-xs font-medium text-slate-700 mb-1">
              Gross withdrawal amount (RWF) *
            </label>
            <input
              id="wd-amt"
              type="number"
              min={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross deducted from wallet</span>
              <span className="font-mono tabular-nums">{formatRwf(gross)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>E-Finance System Fee ({settings.withdrawalFeePercent}%)</span>
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

      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
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
                    {wd.provider} · {wd.phone}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                    Gross {formatRwf(wd.grossAmountRwf)} · Fee {formatRwf(wd.feeRwf)} ({wd.feePercent}%) · Net {formatRwf(wd.netAmountRwf)}
                  </p>
                </div>
                <StatusLabel
                  label={wd.status === 'paid' ? 'Paid' : wd.status === 'rejected' ? 'Rejected' : 'Pending Admin'}
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
