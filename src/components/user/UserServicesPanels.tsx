import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Coins,
  Copy,
  Send,
  Smartphone,
  Wallet,
  Wifi,
} from 'lucide-react';
import {
  AirtimeRequest,
  FxExchangeRecord,
  P2PTransfer,
  RegisteredUser,
  SystemSettings,
  UsdtRequest,
  WalletAddressRecord,
} from '../../types/finance';
import {
  formatDateTime,
  formatRwf,
  formatUsd,
  formatUsdt,
  isValidRwandaPhone,
} from '../../utils/formatters';
import { StatusLabel } from '../StatusLabel';

/* -------------------------------------------------------------------------- */
/* 1. Buy Airtime & Internet Bundles (MTN Rwanda & Airtel Rwanda)             */
/* -------------------------------------------------------------------------- */

const INTERNET_BUNDLES = [
  { label: 'Daily 100MB', amountRwf: 200 },
  { label: 'Daily 300MB', amountRwf: 500 },
  { label: 'Weekly 1.5GB', amountRwf: 1000 },
  { label: 'Monthly 5GB', amountRwf: 3000 },
];

interface UserAirtimeViewProps {
  user: RegisteredUser;
  requests: AirtimeRequest[];
  onRequestAirtime: (payload: {
    network: 'MTN Rwanda' | 'Airtel Rwanda';
    serviceType: 'Airtime' | 'Internet Bundle';
    phoneNumber: string;
    amountRwf: number;
    bundleLabel?: string;
  }) => void;
}

export function UserAirtimeView({
  user,
  requests,
  onRequestAirtime,
}: UserAirtimeViewProps) {
  const [network, setNetwork] = useState<'MTN Rwanda' | 'Airtel Rwanda'>('MTN Rwanda');
  const [serviceType, setServiceType] = useState<'Airtime' | 'Internet Bundle'>('Airtime');
  const [phoneNumber, setPhoneNumber] = useState(user.phone);
  const [amountInput, setAmountInput] = useState('500');
  const [bundleLabel, setBundleLabel] = useState('Custom Internet Bundle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const myRequests = useMemo(
    () => requests.filter((r) => r.userId === user.id),
    [requests, user.id],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!isValidRwandaPhone(phoneNumber)) {
      setError('Enter a valid Rwanda mobile phone number (078/079/072/073).');
      return;
    }
    const amt = Math.round(Number(amountInput) || 0);
    if (amt < 100) {
      setError('Minimum airtime or internet purchase is 100 RWF.');
      return;
    }
    if (amt > user.walletBalanceRwf) {
      setError(`Insufficient wallet balance (${formatRwf(user.walletBalanceRwf)} available).`);
      return;
    }

    onRequestAirtime({
      network,
      serviceType,
      phoneNumber: phoneNumber.trim(),
      amountRwf: amt,
      bundleLabel: serviceType === 'Internet Bundle' ? bundleLabel : undefined,
    });
    setNotice(
      `Wait a moment — your ${network} ${serviceType} order (${formatRwf(amt)} for ${phoneNumber.trim()}) has been sent to Admin for confirmation and delivery.`,
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="pb-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Buy Airtime or Internet (MTN &amp; Airtel Rwanda)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Available wallet:{' '}
            <strong className="font-mono text-[#071B38] tabular-nums">
              {formatRwf(user.walletBalanceRwf)}
            </strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">Select Network *</span>
            <div className="grid grid-cols-2 gap-2">
              {(['MTN Rwanda', 'Airtel Rwanda'] as const).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetwork(net)}
                  className={`h-10 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    network === net
                      ? net === 'MTN Rwanda'
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-red-600 text-white border-red-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">Service Type *</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceType('Airtime')}
                className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                  serviceType === 'Airtime'
                    ? 'bg-[#071B38] text-white border-[#071B38]'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Airtime</span>
              </button>
              <button
                type="button"
                onClick={() => setServiceType('Internet Bundle')}
                className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                  serviceType === 'Internet Bundle'
                    ? 'bg-[#071B38] text-white border-[#071B38]'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Internet Bundle</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="air-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Recipient Phone Number *
            </label>
            <input
              id="air-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+250 788 000 000"
              required
              className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          {serviceType === 'Internet Bundle' ? (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700">Popular Internet Packs</span>
              <div className="grid grid-cols-2 gap-2">
                {INTERNET_BUNDLES.map((pack) => (
                  <button
                    key={pack.label}
                    type="button"
                    onClick={() => {
                      setAmountInput(String(pack.amountRwf));
                      setBundleLabel(pack.label);
                    }}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      bundleLabel === pack.label && Number(amountInput) === pack.amountRwf
                        ? 'bg-blue-50 border-blue-700 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className="font-semibold">{pack.label}</p>
                    <p className="font-mono text-[11px] text-slate-600">{formatRwf(pack.amountRwf)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[200, 500, 1000, 2000, 5000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmountInput(String(val))}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-mono font-semibold text-slate-800"
                >
                  {formatRwf(val)}
                </button>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="air-amt" className="block text-xs font-medium text-slate-700 mb-1">
              Amount (RWF) *
            </label>
            <input
              id="air-amt"
              type="number"
              min={100}
              step={50}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-700">{error}</p>}
          {notice && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
          >
            Order {serviceType} ({formatRwf(Number(amountInput) || 0)})
          </button>
        </form>
      </section>

      <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Your Airtime &amp; Internet Orders</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Orders wait briefly for Admin confirmation. Rejected orders refund automatically to your wallet.
          </p>
        </div>
        {myRequests.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No airtime or internet orders yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {myRequests.map((req) => (
              <div key={req.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {req.network} · {req.serviceType}
                    {req.bundleLabel ? ` (${req.bundleLabel})` : ''}
                  </p>
                  <p className="text-xs font-mono text-slate-600 mt-0.5">
                    Phone: {req.phoneNumber} · Amount: {formatRwf(req.amountRwf)}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {formatDateTime(req.createdAt)}
                  </p>
                </div>
                <StatusLabel
                  label={
                    req.status === 'approved'
                      ? 'Delivered'
                      : req.status === 'rejected'
                        ? 'Rejected (Refunded)'
                        : 'Wait a Moment (Pending)'
                  }
                  tone={
                    req.status === 'approved'
                      ? 'success'
                      : req.status === 'rejected'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Send Money P2P by Receiver Address (with configurable 10% System Tax)   */
/* -------------------------------------------------------------------------- */

interface UserSendMoneyViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  transfers: P2PTransfer[];
  onLookupAddress: (address: string) => Promise<WalletAddressRecord | null>;
  onSendMoney: (payload: {
    receiverId: string;
    receiverName: string;
    receiverAddress: string;
    grossAmountRwf: number;
    note?: string;
  }) => Promise<string | null>;
}

export function UserSendMoneyView({
  user,
  settings,
  transfers,
  onLookupAddress,
  onSendMoney,
}: UserSendMoneyViewProps) {
  const [receiverAddress, setReceiverAddress] = useState('');
  const [amountInput, setAmountInput] = useState('1000');
  const [note, setNote] = useState('');
  const [verifiedRecipient, setVerifiedRecipient] = useState<WalletAddressRecord | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const taxPercent = settings.sendMoneyTaxPercent ?? 10;
  const grossRwf = Math.max(0, Math.round(Number(amountInput) || 0));
  const taxRwf = Math.round((grossRwf * taxPercent) / 100);
  const netRwf = Math.max(0, grossRwf - taxRwf);

  const myTransfers = useMemo(
    () => transfers.filter((t) => t.senderId === user.id || t.receiverId === user.id),
    [transfers, user.id],
  );

  const handleCopyMyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.accountNumber);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleVerifyAddress = async (): Promise<WalletAddressRecord | null> => {
    setError(null);
    const clean = receiverAddress.trim().toUpperCase();
    if (clean.length < 4) {
      setError('Enter a valid receiver address (e.g. EF-RW-XXXXXX).');
      return null;
    }
    if (clean === user.accountNumber.toUpperCase()) {
      setError('You cannot send money to your own receiver address.');
      return null;
    }
    setLookingUp(true);
    try {
      const found = await onLookupAddress(clean);
      if (!found) {
        setVerifiedRecipient(null);
        setError('Receiver address not found. Ask your recipient to copy their address from their dashboard.');
        return null;
      }
      setVerifiedRecipient(found);
      return found;
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (grossRwf < 100) {
      setError('Minimum transfer amount is 100 RWF.');
      return;
    }
    if (grossRwf > user.walletBalanceRwf) {
      setError(`Insufficient wallet balance (${formatRwf(user.walletBalanceRwf)} available).`);
      return;
    }

    const clean = receiverAddress.trim().toUpperCase();
    const recipient =
      verifiedRecipient && verifiedRecipient.address.toUpperCase() === clean
        ? verifiedRecipient
        : await handleVerifyAddress();
    if (!recipient) return;

    setSending(true);
    try {
      const errMsg = await onSendMoney({
        receiverId: recipient.userId,
        receiverName: recipient.fullName,
        receiverAddress: recipient.address,
        grossAmountRwf: grossRwf,
        note: note.trim() || undefined,
      });
      if (errMsg) {
        setError(errMsg);
        return;
      }
      setNotice(
        `Sent ${formatRwf(grossRwf)} to ${recipient.fullName} (${recipient.address}). ${taxPercent}% system tax (${formatRwf(taxRwf)}) deducted; recipient credited ${formatRwf(netRwf)}.`,
      );
      setReceiverAddress('');
      setVerifiedRecipient(null);
      setNote('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User's own receiver address card */}
      <div className="bg-shifting-aurora text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-emerald-300 font-semibold">Your Personal Receiver Address</p>
          <p className="font-mono text-xl font-bold mt-0.5">{user.accountNumber}</p>
          <p className="text-xs text-slate-200 mt-0.5">
            Share this address with any E-Finance member to receive RWF directly in your wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyMyAddress}
          className="h-10 px-4 bg-white text-[#071B38] hover:bg-slate-100 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
        >
          {copiedAddr ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
          <span>{copiedAddr ? 'Address Copied' : 'Copy My Address'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Send Money to User Address</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Wallet Balance:{' '}
              <strong className="font-mono text-[#071B38] tabular-nums">
                {formatRwf(user.walletBalanceRwf)}
              </strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="p2p-addr" className="block text-xs font-medium text-slate-700 mb-1">
                Receiver Wallet Address *
              </label>
              <div className="flex gap-2">
                <input
                  id="p2p-addr"
                  type="text"
                  value={receiverAddress}
                  onChange={(e) => {
                    setReceiverAddress(e.target.value.toUpperCase());
                    setVerifiedRecipient(null);
                  }}
                  placeholder="EF-RW-XXXXXX"
                  required
                  className="flex-1 h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <button
                  type="button"
                  disabled={lookingUp}
                  onClick={() => void handleVerifyAddress()}
                  className="h-10 px-3 border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 shrink-0"
                >
                  {lookingUp ? 'Checking...' : 'Verify'}
                </button>
              </div>
              {verifiedRecipient && (
                <p className="text-xs font-semibold text-emerald-700 mt-1.5">
                  Recipient Verified: {verifiedRecipient.fullName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="p2p-amt" className="block text-xs font-medium text-slate-700 mb-1">
                Amount to Send (RWF) *
              </label>
              <input
                id="p2p-amt"
                type="number"
                min={100}
                step={50}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="p2p-note" className="block text-xs font-medium text-slate-700 mb-1">
                Transfer Note (Optional)
              </label>
              <input
                id="p2p-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Payment for services"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            {/* 10% System Tax Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Deducted from your wallet</span>
                <span className="font-mono tabular-nums">{formatRwf(grossRwf)}</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>E-Finance System Tax ({taxPercent}%)</span>
                <span className="font-mono tabular-nums">-{formatRwf(taxRwf)}</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-800 pt-1.5 border-t border-slate-200">
                <span>Net Amount Received</span>
                <span className="font-mono tabular-nums">{formatRwf(netRwf)}</span>
              </div>
            </div>

            {error && <p className="text-xs font-medium text-red-700">{error}</p>}
            {notice && <p className="text-xs font-medium text-emerald-700">{notice}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Sending...' : 'Send Money Now'}</span>
            </button>
          </form>
        </section>

        <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Your P2P Transfer History</h2>
          </div>
          {myTransfers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No transfers sent or received yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {myTransfers.map((tx) => {
                const isSender = tx.senderId === user.id;
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {isSender
                          ? `Sent to ${tx.receiverName} (${tx.receiverAddress})`
                          : `Received from ${tx.senderName} (${tx.senderAddress})`}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        Gross {formatRwf(tx.grossAmountRwf)} · {tx.taxPercent}% Tax {formatRwf(tx.taxRwf)} · Net {formatRwf(tx.netAmountRwf)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        {formatDateTime(tx.createdAt)} {tx.note ? `· "${tx.note}"` : ''}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                        isSender ? 'text-slate-900' : 'text-emerald-700'
                      }`}
                    >
                      {isSender ? `-${formatRwf(tx.grossAmountRwf)}` : `+${formatRwf(tx.netAmountRwf)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. FX Exchange (RWF <-> USD <-> USDT) + USDT Deposit/Save/Withdraw/Binance */
/* -------------------------------------------------------------------------- */

interface UserExchangeUsdtViewProps {
  user: RegisteredUser;
  settings: SystemSettings;
  fxExchanges: FxExchangeRecord[];
  usdtRequests: UsdtRequest[];
  onFxExchange: (
    direction: FxExchangeRecord['direction'],
    fromAmount: number,
  ) => Promise<string | null> | string | null;
  onUsdtSavingsMove: (
    action: 'deposit' | 'withdraw',
    amountUsdt: number,
  ) => Promise<string | null> | string | null;
  onCreateUsdtRequest: (payload: {
    actionType: UsdtRequest['actionType'];
    amountUsdt: number;
    network: UsdtRequest['network'];
    destinationOrTxRef: string;
    note?: string;
  }) => Promise<string | null> | string | null;
}

export function UserExchangeUsdtView({
  user,
  settings,
  fxExchanges,
  usdtRequests,
  onFxExchange,
  onUsdtSavingsMove,
  onCreateUsdtRequest,
}: UserExchangeUsdtViewProps) {
  const rate = Math.max(100, settings.rwfPerUsdRate || 1380);
  const usdBalance = user.walletBalanceUsd ?? 0;
  const usdtBalance = user.usdtBalance ?? 0;
  const usdtSavings = user.usdtSavingsBalance ?? 0;

  // FX state
  const [fxDirection, setFxDirection] = useState<FxExchangeRecord['direction']>('RWF_TO_USD');
  const [fxInput, setFxInput] = useState('13800');
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxNotice, setFxNotice] = useState<string | null>(null);

  // USDT Savings state
  const [savInput, setSavInput] = useState('10');
  const [savError, setSavError] = useState<string | null>(null);
  const [savNotice, setSavNotice] = useState<string | null>(null);

  // USDT Deposit / Send Binance / Withdraw state
  const [usdtAction, setUsdtAction] = useState<UsdtRequest['actionType']>('send_binance');
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtRequest['network']>('TRC20 (Tron)');
  const [usdtAmountInput, setUsdtAmountInput] = useState('10');
  const [usdtDestOrRef, setUsdtDestOrRef] = useState('');
  const [usdtNote, setUsdtNote] = useState('');
  const [usdtError, setUsdtError] = useState<string | null>(null);
  const [usdtNotice, setUsdtNotice] = useState<string | null>(null);
  const [copiedBin, setCopiedBin] = useState(false);

  const fxFromNum = Math.max(0, Number(fxInput) || 0);
  const fxPreviewTo = useMemo(() => {
    if (fxDirection === 'RWF_TO_USD') return Number((fxFromNum / rate).toFixed(2));
    if (fxDirection === 'USD_TO_RWF') return Math.round(fxFromNum * rate);
    return Number(fxFromNum.toFixed(2));
  }, [fxDirection, fxFromNum, rate]);

  const myFx = useMemo(
    () => fxExchanges.filter((f) => f.userId === user.id),
    [fxExchanges, user.id],
  );
  const myUsdtRequests = useMemo(
    () => usdtRequests.filter((u) => u.userId === user.id),
    [usdtRequests, user.id],
  );

  const handleFxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFxError(null);
    setFxNotice(null);
    const err = await onFxExchange(fxDirection, fxFromNum);
    if (err) {
      setFxError(err);
      return;
    }
    setFxNotice(`Exchange completed: ${fxFromNum} converted to ${fxPreviewTo}.`);
  };

  const handleUsdtSavings = async (action: 'deposit' | 'withdraw') => {
    setSavError(null);
    setSavNotice(null);
    const amt = Number(savInput) || 0;
    const err = await onUsdtSavingsMove(action, amt);
    if (err) {
      setSavError(err);
      return;
    }
    setSavNotice(
      action === 'deposit'
        ? `Saved ${formatUsdt(amt)} into your USDT Savings Vault.`
        : `Moved ${formatUsdt(amt)} back to your USDT Wallet.`,
    );
  };

  const handleUsdtRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsdtError(null);
    setUsdtNotice(null);
    const amt = Number(usdtAmountInput) || 0;
    const err = await onCreateUsdtRequest({
      actionType: usdtAction,
      amountUsdt: amt,
      network: usdtNetwork,
      destinationOrTxRef: usdtDestOrRef.trim(),
      note: usdtNote.trim() || undefined,
    });
    if (err) {
      setUsdtError(err);
      return;
    }
    setUsdtNotice(
      usdtAction === 'deposit'
        ? `USDT deposit (${formatUsdt(amt)}) submitted. Admin will verify and credit your USDT Wallet.`
        : usdtAction === 'send_binance'
          ? `Send to Binance request (${formatUsdt(amt)} via ${usdtNetwork}) submitted. Admin will approve after sending.`
          : `USDT withdrawal (${formatUsdt(amt)}) submitted for Admin approval.`,
    );
    setUsdtDestOrRef('');
    setUsdtNote('');
  };

  return (
    <div className="space-y-6">
      {/* 4 Multi-Currency Balance Strip */}
      <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs text-slate-500">RWF Wallet</p>
          <p className="font-mono text-xl font-bold text-[#071B38] mt-1 tabular-nums">
            {formatRwf(user.walletBalanceRwf)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Rate: 1 USD = {formatRwf(rate)}</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">USD Wallet</p>
          <p className="font-mono text-xl font-bold text-blue-800 mt-1 tabular-nums">
            {formatUsd(usdBalance)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Instant RWF ⇄ USD FX</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">USDT Wallet</p>
          <p className="font-mono text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatUsdt(usdtBalance)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">1 USD = 1.00 USDT</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">USDT Savings Vault</p>
          <p className="font-mono text-xl font-bold text-amber-700 mt-1 tabular-nums">
            {formatUsdt(usdtSavings)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Save &amp; retrieve USDT anytime</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: FX Exchange RWF <-> USD <-> USDT + USDT Savings */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Currency Exchange</h2>
                <p className="text-xs text-slate-500">
                  Convert RWF ⇄ USD or USD ⇄ USDT at live system rates.
                </p>
              </div>
              <ArrowLeftRight className="w-5 h-5 text-blue-800" />
            </div>

            <form onSubmit={handleFxSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'RWF_TO_USD', label: 'RWF → USD' },
                    { id: 'USD_TO_RWF', label: 'USD → RWF' },
                    { id: 'USD_TO_USDT', label: 'USD → USDT' },
                    { id: 'USDT_TO_USD', label: 'USDT → USD' },
                  ] as const
                ).map((dir) => (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => {
                      setFxDirection(dir.id);
                      setFxInput(dir.id === 'RWF_TO_USD' ? String(rate * 10) : '10');
                    }}
                    className={`h-9 px-3 rounded-lg border text-xs font-semibold ${
                      fxDirection === dir.id
                        ? 'bg-[#071B38] text-white border-[#071B38]'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="fx-amt" className="block text-xs font-medium text-slate-700 mb-1">
                  Amount ({fxDirection.split('_')[0]})
                </label>
                <input
                  id="fx-amt"
                  type="number"
                  step="any"
                  min="0.01"
                  value={fxInput}
                  onChange={(e) => setFxInput(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between text-xs">
                <span className="text-slate-600">You Receive</span>
                <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                  {fxDirection === 'USD_TO_RWF'
                    ? formatRwf(fxPreviewTo)
                    : fxDirection === 'RWF_TO_USD' || fxDirection === 'USDT_TO_USD'
                      ? formatUsd(fxPreviewTo)
                      : formatUsdt(fxPreviewTo)}
                </span>
              </div>

              {fxError && <p className="text-xs font-medium text-red-700">{fxError}</p>}
              {fxNotice && <p className="text-xs font-medium text-emerald-700">{fxNotice}</p>}

              <button
                type="submit"
                className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg"
              >
                Convert Instantly
              </button>
            </form>
          </section>

          {/* USDT Savings Vault */}
          <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Save / Retrieve USDT</h2>
                <p className="text-xs text-slate-500">
                  Move USDT between your USDT Wallet and USDT Savings Vault anytime.
                </p>
              </div>
              <Coins className="w-5 h-5 text-emerald-700" />
            </div>

            <div>
              <label htmlFor="usdt-sav-amt" className="block text-xs font-medium text-slate-700 mb-1">
                Amount (USDT)
              </label>
              <input
                id="usdt-sav-amt"
                type="number"
                step="0.01"
                min="0.5"
                value={savInput}
                onChange={(e) => setSavInput(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>

            {savError && <p className="text-xs font-medium text-red-700">{savError}</p>}
            {savNotice && <p className="text-xs font-medium text-emerald-700">{savNotice}</p>}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleUsdtSavings('deposit')}
                className="h-10 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
              >
                Save USDT
              </button>
              <button
                type="button"
                onClick={() => handleUsdtSavings('withdraw')}
                className="h-10 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
              >
                Move to USDT Wallet
              </button>
            </div>
          </section>
        </div>

        {/* Right: Deposit USDT, Withdraw USDT & Send USDT to Binance Address */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  USDT Wallet &amp; Send to Binance Address
                </h2>
                <p className="text-xs text-slate-500">
                  Deposit USDT, send USDT to any Binance address (Admin approves after sending), or withdraw USDT.
                </p>
              </div>
              <Wallet className="w-5 h-5 text-[#071B38]" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'send_binance', label: 'Send to Binance' },
                  { id: 'deposit', label: 'Deposit USDT' },
                  { id: 'withdraw', label: 'Withdraw USDT' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setUsdtAction(tab.id);
                    setUsdtError(null);
                    setUsdtNotice(null);
                  }}
                  className={`h-10 px-2 rounded-lg border text-xs font-semibold ${
                    usdtAction === tab.id
                      ? 'bg-[#071B38] text-white border-[#071B38]'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {usdtAction === 'deposit' && (
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
                <p className="text-[11px] text-emerald-300 font-semibold">
                  Send USDT Deposit to E-Finance Binance / Wallet Address:
                </p>
                <div className="flex items-center justify-between gap-2 bg-white/10 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs break-all">{settings.binanceDepositAddress}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(settings.binanceDepositAddress);
                        setCopiedBin(true);
                        setTimeout(() => setCopiedBin(false), 1800);
                      } catch {
                        // ignore
                      }
                    }}
                    className="px-2.5 py-1 bg-white text-[#071B38] rounded text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                  >
                    {copiedBin ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBin ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleUsdtRequestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="usdt-net" className="block text-xs font-medium text-slate-700 mb-1">
                    Network / Channel *
                  </label>
                  <select
                    id="usdt-net"
                    value={usdtNetwork}
                    onChange={(e) => setUsdtNetwork(e.target.value as UsdtRequest['network'])}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="TRC20 (Tron)">TRC20 (Tron)</option>
                    <option value="BEP20 (BSC)">BEP20 (BSC)</option>
                    <option value="ERC20">ERC20 (Ethereum)</option>
                    <option value="Binance Pay">Binance Pay ID</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="usdt-amt" className="block text-xs font-medium text-slate-700 mb-1">
                    Amount (USDT) *
                  </label>
                  <input
                    id="usdt-amt"
                    type="number"
                    step="0.01"
                    min="1"
                    value={usdtAmountInput}
                    onChange={(e) => setUsdtAmountInput(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="usdt-dest" className="block text-xs font-medium text-slate-700 mb-1">
                  {usdtAction === 'deposit'
                    ? 'Your USDT TxID / Binance Order Reference *'
                    : usdtAction === 'send_binance'
                      ? 'Destination Binance Pay ID or USDT Address *'
                      : 'Your External USDT Withdrawal Address *'}
                </label>
                <input
                  id="usdt-dest"
                  type="text"
                  value={usdtDestOrRef}
                  onChange={(e) => setUsdtDestOrRef(e.target.value)}
                  placeholder={
                    usdtAction === 'deposit'
                      ? 'Paste Blockchain TxHash or Binance Pay ID'
                      : 'Paste Binance Pay ID or Wallet Address (T... / 0x...)'
                  }
                  required
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="usdt-note" className="block text-xs font-medium text-slate-700 mb-1">
                  Note (Optional)
                </label>
                <input
                  id="usdt-note"
                  type="text"
                  value={usdtNote}
                  onChange={(e) => setUsdtNote(e.target.value)}
                  placeholder="Optional instructions for Admin"
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {usdtError && <p className="text-xs font-medium text-red-700">{usdtError}</p>}
              {usdtNotice && <p className="text-xs font-medium text-emerald-700">{usdtNotice}</p>}

              <button
                type="submit"
                className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg"
              >
                {usdtAction === 'deposit'
                  ? 'Submit USDT Deposit for Admin Confirmation'
                  : usdtAction === 'send_binance'
                    ? 'Send USDT to Binance (Admin Approval)'
                    : 'Request USDT Withdrawal'}
              </button>
            </form>
          </section>

          {/* USDT Requests & Recent FX History */}
          <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                USDT Requests &amp; Currency Exchanges
              </h3>
            </div>
            {myUsdtRequests.length === 0 && myFx.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No USDT or FX exchange records yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {myUsdtRequests.map((req) => (
                  <div key={req.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {req.actionType === 'deposit'
                          ? 'USDT Deposit'
                          : req.actionType === 'send_binance'
                            ? 'Send USDT to Binance'
                            : 'Withdraw USDT'}{' '}
                        · {formatUsdt(req.amountUsdt)} ({req.network})
                      </p>
                      <p className="text-xs font-mono text-slate-500 truncate">
                        Ref/Address: {req.destinationOrTxRef}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        {formatDateTime(req.createdAt)}
                      </p>
                    </div>
                    <StatusLabel
                      label={
                        req.status === 'approved'
                          ? 'Approved'
                          : req.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending Admin'
                      }
                      tone={
                        req.status === 'approved'
                          ? 'success'
                          : req.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </div>
                ))}

                {myFx.slice(0, 6).map((fx) => (
                  <div key={fx.id} className="p-4 flex items-center justify-between gap-4 bg-slate-50/60">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        FX {fx.direction.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs font-mono text-slate-600 tabular-nums">
                        {fx.fromAmount} → {fx.toAmount} (Rate {fx.rateApplied})
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatDateTime(fx.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
