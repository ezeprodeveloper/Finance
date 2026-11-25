import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Brain,
  CheckCircle2,
  Clock,
  Flame,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { BetSession, QuizCategory, RegisteredUser } from '../../types/finance';
import { formatDateTime, formatRwf } from '../../utils/formatters';
import { StatusLabel } from '../StatusLabel';

interface QuizQuestion {
  id: string;
  category: Exclude<QuizCategory, 'mixed'>;
  categoryLabel: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

const QUESTION_BANK: QuizQuestion[] = [
  // MATH (Easy, clear 10-second mental arithmetic & algebra)
  { id: 'm1', category: 'math', categoryLabel: 'Math Test', question: 'What is 15 + 27?', options: ['40', '42', '43', '45'], correctIndex: 1 },
  { id: 'm2', category: 'math', categoryLabel: 'Math Test', question: 'What is 12 × 8?', options: ['84', '92', '96', '108'], correctIndex: 2 },
  { id: 'm3', category: 'math', categoryLabel: 'Math Test', question: 'What is 144 ÷ 12?', options: ['11', '12', '13', '14'], correctIndex: 1 },
  { id: 'm4', category: 'math', categoryLabel: 'Math Test', question: 'What is 25% of 200?', options: ['25', '40', '50', '75'], correctIndex: 2 },
  { id: 'm5', category: 'math', categoryLabel: 'Math Test', question: 'Solve for x: x + 9 = 24', options: ['13', '14', '15', '16'], correctIndex: 2 },
  { id: 'm6', category: 'math', categoryLabel: 'Math Test', question: 'What is the square root of 81?', options: ['7', '8', '9', '10'], correctIndex: 2 },
  { id: 'm7', category: 'math', categoryLabel: 'Math Test', question: 'How many degrees are inside a triangle?', options: ['90°', '180°', '270°', '360°'], correctIndex: 1 },
  { id: 'm8', category: 'math', categoryLabel: 'Math Test', question: 'What is 100 - 37?', options: ['63', '67', '73', '53'], correctIndex: 0 },
  { id: 'm9', category: 'math', categoryLabel: 'Math Test', question: 'What is 7 × 9?', options: ['56', '61', '63', '72'], correctIndex: 2 },
  { id: 'm10', category: 'math', categoryLabel: 'Math Test', question: 'Which number is a prime number?', options: ['9', '15', '17', '21'], correctIndex: 2 },
  { id: 'm11', category: 'math', categoryLabel: 'Math Test', question: 'What is 3² + 4²?', options: ['12', '24', '25', '49'], correctIndex: 2 },
  { id: 'm12', category: 'math', categoryLabel: 'Math Test', question: 'What is half of 150?', options: ['65', '70', '75', '80'], correctIndex: 2 },
  { id: 'm13', category: 'math', categoryLabel: 'Math Test', question: 'If 5 notebooks cost 500 RWF, what is the cost of 1 notebook?', options: ['50 RWF', '100 RWF', '125 RWF', '250 RWF'], correctIndex: 1 },
  { id: 'm14', category: 'math', categoryLabel: 'Math Test', question: 'What is 10% of 1,500?', options: ['15', '100', '150', '300'], correctIndex: 2 },
  { id: 'm15', category: 'math', categoryLabel: 'Math Test', question: 'What is 18 × 5?', options: ['80', '85', '90', '95'], correctIndex: 2 },

  // PHYSICS (Fundamental concepts, SI units, motion, energy)
  { id: 'p1', category: 'physics', categoryLabel: 'Physics Test', question: 'What is the SI unit of Force?', options: ['Joule', 'Watt', 'Newton', 'Pascal'], correctIndex: 2 },
  { id: 'p2', category: 'physics', categoryLabel: 'Physics Test', question: 'What is the approximate acceleration due to gravity (g) on Earth?', options: ['4.5 m/s²', '9.8 m/s²', '15.2 m/s²', '20.0 m/s²'], correctIndex: 1 },
  { id: 'p3', category: 'physics', categoryLabel: 'Physics Test', question: 'Speed equals Distance divided by what?', options: ['Mass', 'Time', 'Force', 'Volume'], correctIndex: 1 },
  { id: 'p4', category: 'physics', categoryLabel: 'Physics Test', question: 'What is the SI unit of electrical resistance?', options: ['Volt', 'Ampere', 'Ohm', 'Watt'], correctIndex: 2 },
  { id: 'p5', category: 'physics', categoryLabel: 'Physics Test', question: 'At standard atmospheric pressure, pure water boils at:', options: ['50°C', '80°C', '100°C', '120°C'], correctIndex: 2 },
  { id: 'p6', category: 'physics', categoryLabel: 'Physics Test', question: 'Which formula represents Ohm’s Law?', options: ['V = I × R', 'F = m × a', 'E = m × c²', 'P = F / A'], correctIndex: 0 },
  { id: 'p7', category: 'physics', categoryLabel: 'Physics Test', question: 'What is the SI unit of Energy?', options: ['Newton', 'Joule', 'Kelvin', 'Hertz'], correctIndex: 1 },
  { id: 'p8', category: 'physics', categoryLabel: 'Physics Test', question: 'Sound cannot travel through which medium?', options: ['Water', 'Steel', 'Air', 'A vacuum'], correctIndex: 3 },
  { id: 'p9', category: 'physics', categoryLabel: 'Physics Test', question: 'What particle carries a negative electric charge?', options: ['Proton', 'Neutron', 'Electron', 'Photon'], correctIndex: 2 },
  { id: 'p10', category: 'physics', categoryLabel: 'Physics Test', question: 'Frequency is measured in:', options: ['Meters', 'Hertz', 'Amperes', 'Watts'], correctIndex: 1 },
  { id: 'p11', category: 'physics', categoryLabel: 'Physics Test', question: 'What force pulls objects toward the center of the Earth?', options: ['Friction', 'Magnetism', 'Gravity', 'Tension'], correctIndex: 2 },
  { id: 'p12', category: 'physics', categoryLabel: 'Physics Test', question: 'Power is measured in:', options: ['Watts', 'Newtons', 'Ohms', 'Coulombs'], correctIndex: 0 },
  { id: 'p13', category: 'physics', categoryLabel: 'Physics Test', question: 'Which color of visible light has the longest wavelength?', options: ['Violet', 'Blue', 'Green', 'Red'], correctIndex: 3 },
  { id: 'p14', category: 'physics', categoryLabel: 'Physics Test', question: 'What is the SI unit of electric current?', options: ['Volt', 'Ampere', 'Watt', 'Joule'], correctIndex: 1 },
  { id: 'p15', category: 'physics', categoryLabel: 'Physics Test', question: 'Light travels fastest in:', options: ['Glass', 'Water', 'Air', 'A vacuum'], correctIndex: 3 },

  // WORLD KNOWLEDGE (World geography, capitals, Rwanda & Africa, global science)
  { id: 'w1', category: 'world', categoryLabel: 'World Test', question: 'What is the capital city of Rwanda?', options: ['Huye', 'Musanze', 'Kigali', 'Rubavu'], correctIndex: 2 },
  { id: 'w2', category: 'world', categoryLabel: 'World Test', question: 'Which is the largest ocean on Earth?', options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'], correctIndex: 2 },
  { id: 'w3', category: 'world', categoryLabel: 'World Test', question: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], correctIndex: 2 },
  { id: 'w4', category: 'world', categoryLabel: 'World Test', question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 },
  { id: 'w5', category: 'world', categoryLabel: 'World Test', question: 'What is the capital city of Japan?', options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], correctIndex: 2 },
  { id: 'w6', category: 'world', categoryLabel: 'World Test', question: 'Which gas do humans breathe in to stay alive?', options: ['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Helium'], correctIndex: 1 },
  { id: 'w7', category: 'world', categoryLabel: 'World Test', question: 'Which famous lake lies on the western border of Rwanda?', options: ['Lake Victoria', 'Lake Kivu', 'Lake Tanganyika', 'Lake Turkana'], correctIndex: 1 },
  { id: 'w8', category: 'world', categoryLabel: 'World Test', question: 'What is the capital city of France?', options: ['Lyon', 'Marseille', 'Paris', 'Nice'], correctIndex: 2 },
  { id: 'w9', category: 'world', categoryLabel: 'World Test', question: 'Which is the largest continent by land area?', options: ['Africa', 'Europe', 'Asia', 'South America'], correctIndex: 2 },
  { id: 'w10', category: 'world', categoryLabel: 'World Test', question: 'How many hours make one full day?', options: ['12', '20', '24', '48'], correctIndex: 2 },
  { id: 'w11', category: 'world', categoryLabel: 'World Test', question: 'What chemical symbol represents Water?', options: ['CO2', 'H2O', 'O2', 'NaCl'], correctIndex: 1 },
  { id: 'w12', category: 'world', categoryLabel: 'World Test', question: 'Which country is home to Mount Kilimanjaro?', options: ['Kenya', 'Tanzania', 'Uganda', 'Ethiopia'], correctIndex: 1 },
  { id: 'w13', category: 'world', categoryLabel: 'World Test', question: 'What is the currency of Rwanda?', options: ['Rwandan Franc (RWF)', 'Kenyan Shilling', 'Dollar', 'Euro'], correctIndex: 0 },
  { id: 'w14', category: 'world', categoryLabel: 'World Test', question: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], correctIndex: 1 },
  { id: 'w15', category: 'world', categoryLabel: 'World Test', question: 'Which continent has the most countries?', options: ['Asia', 'Europe', 'Africa', 'South America'], correctIndex: 2 },
];

const MULTIPLIER_BY_STEP = [1.0, 1.2, 1.45, 1.75, 2.1, 2.5, 2.95, 3.45, 4.0, 4.6, 5.25];

function getMultiplierForCorrectCount(count: number): number {
  if (count <= 0) return 1;
  if (count < MULTIPLIER_BY_STEP.length) return MULTIPLIER_BY_STEP[count];
  return Number((5.25 + (count - 10) * 0.65).toFixed(2));
}

function shuffleQuestions(list: QuizQuestion[]): QuizQuestion[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface QuizBetArenaProps {
  user: RegisteredUser;
  betSessions: BetSession[];
  onStartBet: (stakeRwf: number) => void;
  onFinishBet: (session: BetSession) => void;
}

type RoundPhase = 'setup' | 'playing' | 'between_questions' | 'lost' | 'cashed_out';

export function QuizBetArena({
  user,
  betSessions,
  onStartBet,
  onFinishBet,
}: QuizBetArenaProps) {
  const [category, setCategory] = useState<QuizCategory>('mixed');
  const [stakeInput, setStakeInput] = useState('200');
  const [setupError, setSetupError] = useState<string | null>(null);

  const [phase, setPhase] = useState<RoundPhase>('setup');
  const [activeStake, setActiveStake] = useState(0);
  const [deck, setDeck] = useState<QuizQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [endMessage, setEndMessage] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(10.0);

  const deadlineRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);

  const currentQuestion = deck[questionIdx] ?? null;
  const currentMultiplier = getMultiplierForCorrectCount(questionsAnswered);
  const currentPayoutRwf = Math.round(activeStake * currentMultiplier);
  const nextMultiplier = getMultiplierForCorrectCount(questionsAnswered + 1);
  const nextPayoutRwf = Math.round(activeStake * nextMultiplier);

  const recordOutcome = (
    status: 'won_cashed_out' | 'lost',
    answeredCount: number,
    payoutRwf: number,
    reason: string,
  ) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const mult = status === 'lost' ? 0 : getMultiplierForCorrectCount(answeredCount);
    onFinishBet({
      id: `bet-${Date.now()}`,
      userId: user.id,
      userName: `${user.firstName} ${user.secondName}`,
      category,
      stakeRwf: activeStake,
      questionsAnswered: answeredCount,
      multiplier: mult,
      payoutRwf,
      status,
      endedReason: reason,
      createdAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (phase !== 'playing') return;

    deadlineRef.current = Date.now() + 10000;
    setSecondsLeft(10.0);

    const intervalId = window.setInterval(() => {
      const remainingMs = Math.max(0, deadlineRef.current - Date.now());
      const sec = remainingMs / 1000;
      setSecondsLeft(sec);

      if (remainingMs <= 0) {
        window.clearInterval(intervalId);
        setPhase('lost');
        setEndMessage('Time expired (10s limit reached). Bet lost — restart to bet again!');
        recordOutcome('lost', questionsAnswered, 0, 'Timed out after 10 seconds');
      }
    }, 100);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIdx]);

  const myBets = useMemo(
    () => betSessions.filter((b) => b.userId === user.id),
    [betSessions, user.id],
  );

  const handleStartRound = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    const stake = Math.round(Number(stakeInput) || 0);
    if (stake < 100) {
      setSetupError('Minimum quiz bet stake is 100 RWF.');
      return;
    }
    if (stake > user.walletBalanceRwf) {
      setSetupError(`Insufficient wallet balance (${formatRwf(user.walletBalanceRwf)} available).`);
      return;
    }

    const pool =
      category === 'mixed'
        ? QUESTION_BANK
        : QUESTION_BANK.filter((q) => q.category === category);

    finishedRef.current = false;
    setDeck(shuffleQuestions(pool));
    setActiveStake(stake);
    setQuestionIdx(0);
    setQuestionsAnswered(0);
    setSelectedOption(null);
    setEndMessage('');
    onStartBet(stake);
    setPhase('playing');
  };

  const handleChooseOption = (optIndex: number) => {
    if (phase !== 'playing' || !currentQuestion) return;
    setSelectedOption(optIndex);

    if (optIndex === currentQuestion.correctIndex) {
      const nextCount = questionsAnswered + 1;
      setQuestionsAnswered(nextCount);
      setPhase('between_questions');
    } else {
      setPhase('lost');
      setEndMessage(
        `Wrong answer! Correct option was "${currentQuestion.options[currentQuestion.correctIndex]}". Bet restarted to 0 — place a new bet to play again.`,
      );
      recordOutcome(
        'lost',
        questionsAnswered,
        0,
        `Incorrect answer on Q${questionsAnswered + 1}`,
      );
    }
  };

  const handleNextQuestion = () => {
    const nextIdx = questionIdx + 1;
    if (nextIdx >= deck.length) {
      // Reshuffle fresh deck so streaks can continue seamlessly!
      const pool =
        category === 'mixed'
          ? QUESTION_BANK
          : QUESTION_BANK.filter((q) => q.category === category);
      setDeck(shuffleQuestions(pool));
      setQuestionIdx(0);
    } else {
      setQuestionIdx(nextIdx);
    }
    setSelectedOption(null);
    setPhase('playing');
  };

  const handleCashOut = () => {
    if (phase !== 'between_questions' || questionsAnswered <= 0) return;
    const payout = Math.round(activeStake * getMultiplierForCorrectCount(questionsAnswered));
    setPhase('cashed_out');
    setEndMessage(`Congratulations! Cashed out ${formatRwf(payout)} to your Main Wallet.`);
    recordOutcome(
      'won_cashed_out',
      questionsAnswered,
      payout,
      `Cashed out after ${questionsAnswered} correct answer${questionsAnswered > 1 ? 's' : ''}`,
    );
  };

  const handleResetToSetup = () => {
    setPhase('setup');
    setSelectedOption(null);
    setEndMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Top Arena Banner */}
      <div className="bg-shifting-aurora text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
            <Brain className="w-4 h-4" />
            <span>10-Second Quiz Bet Arena · Math, Physics &amp; World Tests</span>
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            Answer within 10s &amp; Grow Your Bet Multiplier
          </h2>
          <p className="text-xs text-slate-200 max-w-2xl">
            Bet any amount from your wallet. Each correct answer boosts your multiplier. Cash out anytime after Q1, or risk going further — 1 wrong answer or timeout restarts the bet!
          </p>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 shrink-0">
          <p className="text-[11px] text-slate-200">Available Wallet</p>
          <p className="font-mono text-lg font-bold text-emerald-300 tabular-nums">
            {formatRwf(user.walletBalanceRwf)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Arena Card */}
        <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl p-6">
          {phase === 'setup' && (
            <form onSubmit={handleStartRound} className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Configure New Quiz Bet</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose a subject and stake RWF to begin your 10-second rapid-fire round.
                </p>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Select Subject / Test Category
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'mixed', label: 'Mixed All' },
                      { id: 'math', label: 'Math Test' },
                      { id: 'physics', label: 'Physics Test' },
                      { id: 'world', label: 'World Test' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`h-10 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                        category === cat.id
                          ? 'bg-[#071B38] text-white border-[#071B38]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="quiz-stake" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Bet Stake Amount (RWF) · Min 100 RWF
                </label>
                <input
                  id="quiz-stake"
                  type="number"
                  min={100}
                  step={50}
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  required
                  className="w-full h-11 px-3 text-base font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[100, 200, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStakeInput(String(amt))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-mono font-semibold"
                    >
                      {formatRwf(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multiplier Ladder Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-800">Payout Multiplier Ladder</p>
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                  {[1, 2, 3, 4, 5].map((q) => {
                    const m = getMultiplierForCorrectCount(q);
                    return (
                      <div key={q} className="bg-white border border-slate-200 rounded-lg p-2">
                        <span className="text-[11px] text-slate-500 block">Q{q}</span>
                        <span className="font-bold text-emerald-700">{m}x</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {setupError && (
                <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  {setupError}
                </p>
              )}

              <button
                type="submit"
                className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                <span>Place Bet &amp; Start 10s Quiz</span>
              </button>
            </form>
          )}

          {phase === 'playing' && currentQuestion && (
            <div className="space-y-5">
              {/* Header + Live 10s Timer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-[#071B38] text-white rounded text-xs font-semibold">
                    Question {questionsAnswered + 1}
                  </span>
                  <span className="text-xs font-semibold text-blue-800">
                    {currentQuestion.categoryLabel}
                  </span>
                </div>

                <div
                  className={`px-3 py-1 rounded-lg font-mono text-sm font-bold inline-flex items-center gap-1.5 tabular-nums ${
                    secondsLeft <= 3
                      ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{secondsLeft.toFixed(1)}s</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    secondsLeft <= 3 ? 'bg-red-600' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / 10) * 100))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
                <span>
                  Stake: <strong className="font-mono">{formatRwf(activeStake)}</strong>
                </span>
                <span>
                  Win if correct:{' '}
                  <strong className="font-mono text-emerald-700">
                    {formatRwf(nextPayoutRwf)} ({nextMultiplier}x)
                  </strong>
                </span>
              </div>

              <h3 className="font-display text-lg font-bold text-slate-900">
                {currentQuestion.question}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleChooseOption(idx)}
                    className="min-h-[48px] px-4 py-3 text-left text-sm font-medium bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-600 rounded-xl text-slate-900 transition-colors flex items-center gap-3"
                  >
                    <span className="w-6 h-6 rounded-md bg-slate-100 text-[#071B38] font-mono text-xs font-bold inline-flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'between_questions' && (
            <div className="space-y-5 py-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2">
                <p className="text-xs font-semibold text-emerald-800 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Correct Answer! Streak: {questionsAnswered}</span>
                </p>
                <h3 className="font-display text-2xl font-bold text-[#071B38] tabular-nums">
                  Current Win: {formatRwf(currentPayoutRwf)} ({currentMultiplier}x)
                </h3>
                <p className="text-xs text-slate-600">
                  Cash out now to secure {formatRwf(currentPayoutRwf)} in your wallet, or answer Question {questionsAnswered + 1} for{' '}
                  <strong>{formatRwf(nextPayoutRwf)} ({nextMultiplier}x)</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCashOut}
                  className="h-11 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  <span>Cash Out {formatRwf(currentPayoutRwf)}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="h-11 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Next Question (10s Timer)</span>
                </button>
              </div>
            </div>
          )}

          {(phase === 'lost' || phase === 'cashed_out') && (
            <div className="space-y-5 py-2">
              <div
                className={`rounded-xl p-5 border space-y-2 ${
                  phase === 'cashed_out'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <p className="text-sm font-bold inline-flex items-center gap-2">
                  {phase === 'cashed_out' ? (
                    <Award className="w-5 h-5 text-emerald-700" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-700" />
                  )}
                  <span>
                    {phase === 'cashed_out'
                      ? `Bet Won & Cashed Out: ${formatRwf(currentPayoutRwf)}`
                      : 'Round Ended — Bet Restarted'}
                  </span>
                </p>
                <p className="text-xs leading-relaxed">{endMessage}</p>
                {selectedOption !== null && currentQuestion && phase === 'lost' && (
                  <p className="text-xs font-mono">
                    Question: {currentQuestion.question} | Correct Answer:{' '}
                    <strong>{currentQuestion.options[currentQuestion.correctIndex]}</strong>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetToSetup}
                className="w-full h-11 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart &amp; Bet Again</span>
              </button>
            </div>
          )}
        </section>

        {/* Recent Quiz Bet History */}
        <section className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Your Recent Quiz Bets</h3>
          </div>
          {myBets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No quiz bet rounds played yet. Place a bet on the left to start!
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {myBets.slice(0, 10).map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 capitalize">
                      {b.category} Quiz · {b.questionsAnswered} Qs ({b.multiplier}x)
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      Stake {formatRwf(b.stakeRwf)} · {b.endedReason}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      {formatDateTime(b.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <StatusLabel
                      label={b.status === 'won_cashed_out' ? `+${formatRwf(b.payoutRwf)}` : 'Lost'}
                      tone={b.status === 'won_cashed_out' ? 'success' : 'danger'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
