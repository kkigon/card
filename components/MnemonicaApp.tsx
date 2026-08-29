'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Suit = 'clubs' | 'hearts' | 'diamonds' | 'spades';
type Direction = 'card-to-number' | 'number-to-card';
type StudyMode = Direction | 'mixed';
type Tab = 'memorize' | 'learn' | 'test' | 'stack';

type StackCard = {
  number: number;
  rank: string;
  suit: Suit;
  symbol: string;
  code: string;
};

type Progress = {
  known: number[];
  incrementalMastered: number;
  streak: number;
  lastStudy: string | null;
  studiedToday: number;
  totalAnswers: number;
  correctAnswers: number;
  dailyBest: Record<string, number>;
};

type GrowthPoint = { date: string; score: number };

type TestQuestion = {
  cardNumber: number;
  direction: Direction;
  options: number[];
};

const RAW_STACK: Array<[string, Suit]> = [
  ['4', 'clubs'], ['2', 'hearts'], ['7', 'diamonds'], ['3', 'clubs'],
  ['4', 'hearts'], ['6', 'diamonds'], ['A', 'spades'], ['5', 'hearts'],
  ['9', 'spades'], ['2', 'spades'], ['Q', 'hearts'], ['3', 'diamonds'],
  ['Q', 'clubs'], ['8', 'hearts'], ['6', 'spades'], ['5', 'spades'],
  ['9', 'hearts'], ['K', 'clubs'], ['2', 'diamonds'], ['J', 'hearts'],
  ['3', 'spades'], ['8', 'spades'], ['6', 'hearts'], ['10', 'clubs'],
  ['5', 'diamonds'], ['K', 'diamonds'], ['2', 'clubs'], ['3', 'hearts'],
  ['8', 'diamonds'], ['5', 'clubs'], ['K', 'spades'], ['J', 'diamonds'],
  ['8', 'clubs'], ['10', 'spades'], ['K', 'hearts'], ['J', 'clubs'],
  ['7', 'spades'], ['10', 'hearts'], ['A', 'diamonds'], ['4', 'spades'],
  ['7', 'hearts'], ['4', 'diamonds'], ['A', 'clubs'], ['9', 'clubs'],
  ['J', 'spades'], ['Q', 'diamonds'], ['7', 'clubs'], ['Q', 'spades'],
  ['10', 'diamonds'], ['6', 'clubs'], ['A', 'hearts'], ['9', 'diamonds'],
];

const SUIT_META: Record<Suit, { symbol: string; letter: string; name: string }> = {
  clubs: { symbol: '♣', letter: 'C', name: '클럽' },
  hearts: { symbol: '♥', letter: 'H', name: '하트' },
  diamonds: { symbol: '♦', letter: 'D', name: '다이아' },
  spades: { symbol: '♠', letter: 'S', name: '스페이드' },
};

export const MNEMONICA_STACK: StackCard[] = RAW_STACK.map(([rank, suit], index) => ({
  number: index + 1,
  rank,
  suit,
  symbol: SUIT_META[suit].symbol,
  code: `${rank}${SUIT_META[suit].letter}`,
}));

const DEFAULT_PROGRESS: Progress = {
  known: [],
  incrementalMastered: 0,
  streak: 0,
  lastStudy: null,
  studiedToday: 0,
  totalAnswers: 0,
  correctAnswers: 0,
  dailyBest: {},
};

const MODE_LABELS: Record<StudyMode, string> = {
  'card-to-number': '카드 → 숫자',
  'number-to-card': '숫자 → 카드',
  mixed: '섞어서',
};

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'memorize', label: '외우기', icon: '◫' },
  { id: 'learn', label: '학습', icon: '◎' },
  { id: 'test', label: '시험', icon: '✓' },
  { id: 'stack', label: '전체', icon: '▦' },
];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

function CardVisual({ card, mini = false }: { card: StackCard; mini?: boolean }) {
  const rankName: Record<string, string> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
  const imageName = `${rankName[card.rank] ?? card.rank}_of_${card.suit}.png`;
  return (
    <div className={`card-face ${mini ? 'mini' : ''}`}>
      <img
        src={`./cards/${imageName}`}
        alt={`${card.rank} ${SUIT_META[card.suit].name}`}
        draggable={false}
      />
    </div>
  );
}

function SegmentedMode({ value, onChange }: { value: StudyMode; onChange: (mode: StudyMode) => void }) {
  return (
    <div className="segmented" aria-label="출제 방식">
      {(Object.keys(MODE_LABELS) as StudyMode[]).map((mode) => (
        <button key={mode} className={value === mode ? 'selected' : ''} onClick={() => onChange(mode)}>{MODE_LABELS[mode]}</button>
      ))}
    </div>
  );
}

function EmptySession({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="completion-card">
      <span className="completion-mark">✓</span>
      <p className="eyebrow">SESSION COMPLETE</p>
      <h2>오늘의 52장을<br />모두 넘겼어요.</h2>
      <p>잠깐 쉬었다가 한 번 더 섞어보세요. 짧게 자주 보는 편이 오래 남습니다.</p>
      <button className="primary-button" onClick={onRestart}>다시 섞어서 시작</button>
    </section>
  );
}

function GrowthChart({ points }: { points: GrowthPoint[] }) {
  if (!points.length) {
    return (
      <section className="growth-card empty-growth">
        <div className="growth-heading"><div><p className="eyebrow">DAILY BEST</p><h2>최고 정답률 성장</h2></div><span>—</span></div>
        <div className="growth-empty-mark">↗</div>
        <p>시험을 한 번 끝내면 오늘의 최고 정답률부터 기록해요.</p>
        <small>같은 날 여러 번 보면 가장 높은 점수만 남습니다.</small>
      </section>
    );
  }

  const width = 360;
  const height = 168;
  const inset = { left: 30, right: 12, top: 16, bottom: 29 };
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const xFor = (index: number) => points.length === 1 ? inset.left + plotWidth / 2 : inset.left + (index / (points.length - 1)) * plotWidth;
  const yFor = (score: number) => inset.top + ((100 - score) / 100) * plotHeight;
  const coordinates = points.map((point, index) => `${xFor(index)},${yFor(point.score)}`).join(' ');
  const areaCoordinates = points.length > 1
    ? `${inset.left},${height - inset.bottom} ${coordinates} ${width - inset.right},${height - inset.bottom}`
    : '';
  const first = points[0];
  const latest = points[points.length - 1];
  const peak = Math.max(...points.map((point) => point.score));
  const growth = latest.score - first.score;
  const dateLabel = (date: string) => {
    const [, month, day] = date.split('-');
    return `${Number(month)}/${Number(day)}`;
  };
  const shouldLabel = (index: number) => points.length <= 7 || index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);

  return (
    <section className="growth-card">
      <div className="growth-heading">
        <div><p className="eyebrow">DAILY BEST · 최근 {points.length}일</p><h2>최고 정답률 성장</h2></div>
        <span className={growth >= 0 ? 'positive' : 'negative'}>{growth >= 0 ? '+' : ''}{growth}%p</span>
      </div>
      <div className="growth-summary"><span>최근 <b>{latest.score}%</b></span><span>최고 <b>{peak}%</b></span></div>
      <svg className="growth-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`날짜별 최고 정답률 그래프. 최근 ${latest.score}퍼센트, 최고 ${peak}퍼센트`}>
        {[0, 25, 50, 75, 100].map((score) => {
          const y = yFor(score);
          return <g key={score}><line x1={inset.left} y1={y} x2={width - inset.right} y2={y} className="chart-grid" /><text x={inset.left - 6} y={y + 3} className="chart-y-label">{score}</text></g>;
        })}
        {areaCoordinates && <polygon points={areaCoordinates} className="chart-area" />}
        {points.length > 1 && <polyline points={coordinates} className="chart-line" />}
        {points.map((point, index) => (
          <g key={point.date}>
            <circle cx={xFor(index)} cy={yFor(point.score)} r={index === points.length - 1 ? 5 : 3.5} className={index === points.length - 1 ? 'chart-dot latest' : 'chart-dot'} />
            {index === points.length - 1 && <text x={xFor(index)} y={yFor(point.score) - 10} className="chart-score-label">{point.score}%</text>}
            {shouldLabel(index) && <text x={xFor(index)} y={height - 8} className="chart-x-label">{dateLabel(point.date)}</text>}
          </g>
        ))}
      </svg>
      <p className="growth-footnote">각 날짜에 완료한 시험 중 가장 높은 정답률을 표시합니다.</p>
    </section>
  );
}

export default function MnemonicaApp() {
  const [tab, setTab] = useState<Tab>('memorize');
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [hydrated, setHydrated] = useState(false);
  const [memorizeMode, setMemorizeMode] = useState<StudyMode>('mixed');
  const [queue, setQueue] = useState<number[]>(MNEMONICA_STACK.map((card) => card.number));
  const [sessionDone, setSessionDone] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState('');
  const [learnRange, setLearnRange] = useState(0);
  const [focusedCard, setFocusedCard] = useState(1);
  const [learnView, setLearnView] = useState<'overview' | 'incremental'>('overview');
  const [incrementalStage, setIncrementalStage] = useState<'teach' | 'quiz' | 'result'>('teach');
  const [incrementalQuestions, setIncrementalQuestions] = useState<TestQuestion[]>([]);
  const [incrementalIndex, setIncrementalIndex] = useState(0);
  const [incrementalSelected, setIncrementalSelected] = useState<number | null>(null);
  const [incrementalScore, setIncrementalScore] = useState(0);
  const [incrementalWrong, setIncrementalWrong] = useState<number[]>([]);
  const [incrementalPerfect, setIncrementalPerfect] = useState(false);
  const [incrementalResetArmed, setIncrementalResetArmed] = useState(false);
  const [testMode, setTestMode] = useState<StudyMode>('mixed');
  const [testCount, setTestCount] = useState(10);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [testScore, setTestScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [testComplete, setTestComplete] = useState(false);
  const [stackSearch, setStackSearch] = useState('');
  const [suitFilter, setSuitFilter] = useState<Suit | 'all'>('all');
  const [resetArmed, setResetArmed] = useState(false);
  const dragStart = useRef(0);
  const movedDuringDrag = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let storedProgress: Progress | null = null;
    let storedMode: StudyMode | null = null;
    try {
      const stored = window.localStorage.getItem('mnemonica-progress-v1');
      if (stored) {
        const parsed = JSON.parse(stored) as Progress;
        storedProgress = { ...DEFAULT_PROGRESS, ...parsed, studiedToday: parsed.lastStudy === dateKey() ? parsed.studiedToday : 0 };
      }
      const savedMode = window.localStorage.getItem('mnemonica-mode-v1') as StudyMode | null;
      if (savedMode && MODE_LABELS[savedMode]) storedMode = savedMode;
    } catch {
      // Local progress is optional; the app remains fully usable without it.
    }
    const frame = window.requestAnimationFrame(() => {
      if (storedProgress) setProgress(storedProgress);
      if (storedMode) setMemorizeMode(storedMode);
      setQueue(shuffle(MNEMONICA_STACK.map((card) => card.number)));
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('mnemonica-progress-v1', JSON.stringify(progress));
  }, [hydrated, progress]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('mnemonica-mode-v1', memorizeMode);
  }, [hydrated, memorizeMode]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  const recordActivity = (correct?: boolean) => {
    setProgress((previous) => {
      const today = dateKey();
      const isNewDay = previous.lastStudy !== today;
      const streak = isNewDay ? (previous.lastStudy === yesterdayKey() ? previous.streak + 1 : 1) : previous.streak;
      return {
        ...previous,
        streak,
        lastStudy: today,
        studiedToday: (isNewDay ? 0 : previous.studiedToday) + 1,
        totalAnswers: previous.totalAnswers + (typeof correct === 'boolean' ? 1 : 0),
        correctAnswers: previous.correctAnswers + (correct ? 1 : 0),
      };
    });
  };

  const recordDailyBest = (score: number) => {
    const today = dateKey();
    setProgress((previous) => {
      const dailyBest = previous.dailyBest ?? {};
      const previousBest = dailyBest[today] ?? 0;
      if (Object.prototype.hasOwnProperty.call(dailyBest, today) && score <= previousBest) return previous;
      return { ...previous, dailyBest: { ...dailyBest, [today]: score } };
    });
  };

  const restartMemorize = (onlyUnknown = false) => {
    const source = onlyUnknown
      ? MNEMONICA_STACK.filter((card) => !progress.known.includes(card.number)).map((card) => card.number)
      : MNEMONICA_STACK.map((card) => card.number);
    setQueue(shuffle(source.length ? source : MNEMONICA_STACK.map((card) => card.number)));
    setSessionDone(0);
    setRevealed(false);
    setActionCount(0);
  };

  const currentNumber = queue[0];
  const currentCard = currentNumber ? MNEMONICA_STACK[currentNumber - 1] : null;
  const currentDirection: Direction = memorizeMode === 'mixed'
    ? ((currentNumber + actionCount) % 2 ? 'card-to-number' : 'number-to-card')
    : memorizeMode;

  const rateCard = (known: boolean) => {
    if (!currentCard) return;
    const rest = queue.slice(1);
    if (known) {
      setQueue(rest);
      setSessionDone((value) => value + 1);
      setProgress((previous) => ({ ...previous, known: Array.from(new Set([...previous.known, currentCard.number])) }));
      showToast('외운 카드에 추가했어요');
    } else {
      const insertAt = Math.min(4, rest.length);
      const nextQueue = [...rest];
      nextQueue.splice(insertAt, 0, currentCard.number);
      setQueue(nextQueue);
      setProgress((previous) => ({ ...previous, known: previous.known.filter((number) => number !== currentCard.number) }));
      showToast(`${Math.max(insertAt, 1)}장 뒤에 다시 나와요`);
    }
    recordActivity();
    setRevealed(false);
    setDragX(0);
    setActionCount((value) => value + 1);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientX;
    movedDuringDrag.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const nextX = Math.max(-160, Math.min(160, event.clientX - dragStart.current));
    if (Math.abs(nextX) > 8) movedDuringDrag.current = true;
    setDragX(nextX);
  };

  const handlePointerUp = () => {
    setDragging(false);
    if (Math.abs(dragX) >= 82) rateCard(dragX > 0);
    else setDragX(0);
  };

  const handleStudyCardClick = () => {
    if (movedDuringDrag.current) {
      movedDuringDrag.current = false;
      return;
    }
    setRevealed((value) => !value);
  };

  const startTest = (ids?: number[]) => {
    const source = ids?.length ? ids : MNEMONICA_STACK.map((card) => card.number);
    const selected = shuffle(source).slice(0, Math.min(testCount, source.length));
    const nextQuestions = selected.map((cardNumber, index) => {
      const direction: Direction = testMode === 'mixed'
        ? (index % 2 ? 'number-to-card' : 'card-to-number')
        : testMode;
      const distractors = shuffle(MNEMONICA_STACK.map((card) => card.number).filter((number) => number !== cardNumber)).slice(0, 3);
      return { cardNumber, direction, options: shuffle([cardNumber, ...distractors]) };
    });
    setQuestions(nextQuestions);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setTestScore(0);
    setWrongAnswers([]);
    setTestComplete(false);
  };

  const selectTestAnswer = (answer: number) => {
    if (selectedAnswer !== null) return;
    const question = questions[questionIndex];
    const correct = answer === question.cardNumber;
    setSelectedAnswer(answer);
    if (correct) {
      setTestScore((value) => value + 1);
      setProgress((previous) => ({ ...previous, known: Array.from(new Set([...previous.known, question.cardNumber])) }));
    } else {
      setWrongAnswers((previous) => Array.from(new Set([...previous, question.cardNumber])));
    }
    recordActivity(correct);
  };

  const nextQuestion = () => {
    if (questionIndex >= questions.length - 1) {
      const completedPercent = Math.round((testScore / questions.length) * 100);
      recordDailyBest(completedPercent);
      setTestComplete(true);
      return;
    }
    setQuestionIndex((value) => value + 1);
    setSelectedAnswer(null);
  };

  const startIncrementalQuiz = () => {
    const learnedCount = Math.min(progress.incrementalMastered + 1, MNEMONICA_STACK.length);
    const learnedNumbers = Array.from({ length: learnedCount }, (_, index) => index + 1);
    const nextQuestions = shuffle(learnedNumbers).map((cardNumber, index) => {
      const direction: Direction = (index + learnedCount) % 2 === 0 ? 'card-to-number' : 'number-to-card';
      const distractors = shuffle(MNEMONICA_STACK
        .map((card) => card.number)
        .filter((number) => number !== cardNumber)).slice(0, 3);
      return { cardNumber, direction, options: shuffle([cardNumber, ...distractors]) };
    });
    setIncrementalQuestions(nextQuestions);
    setIncrementalIndex(0);
    setIncrementalSelected(null);
    setIncrementalScore(0);
    setIncrementalWrong([]);
    setIncrementalPerfect(false);
    setIncrementalStage('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectIncrementalAnswer = (answer: number) => {
    if (incrementalSelected !== null) return;
    const question = incrementalQuestions[incrementalIndex];
    const correct = answer === question.cardNumber;
    setIncrementalSelected(answer);
    if (correct) {
      setIncrementalScore((value) => value + 1);
    } else {
      setIncrementalWrong((previous) => Array.from(new Set([...previous, question.cardNumber])));
    }
    recordActivity(correct);
  };

  const nextIncrementalQuestion = () => {
    if (incrementalIndex < incrementalQuestions.length - 1) {
      setIncrementalIndex((value) => value + 1);
      setIncrementalSelected(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const completedPercent = Math.round((incrementalScore / incrementalQuestions.length) * 100);
    const perfect = incrementalScore === incrementalQuestions.length;
    recordDailyBest(completedPercent);
    setIncrementalPerfect(perfect);
    if (perfect) {
      const learnedCount = incrementalQuestions.length;
      setProgress((previous) => ({
        ...previous,
        incrementalMastered: Math.max(previous.incrementalMastered, learnedCount),
        known: Array.from(new Set([...previous.known, ...Array.from({ length: learnedCount }, (_, index) => index + 1)])),
      }));
    }
    setIncrementalStage('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const continueIncrementalCourse = () => {
    setIncrementalQuestions([]);
    setIncrementalIndex(0);
    setIncrementalSelected(null);
    setIncrementalScore(0);
    setIncrementalWrong([]);
    setIncrementalPerfect(false);
    setIncrementalStage('teach');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetIncrementalCourse = () => {
    if (!incrementalResetArmed) {
      setIncrementalResetArmed(true);
      setTimeout(() => setIncrementalResetArmed(false), 3000);
      return;
    }
    setProgress((previous) => ({ ...previous, incrementalMastered: 0 }));
    setIncrementalResetArmed(false);
    continueIncrementalCourse();
    showToast('누적 코스를 처음부터 시작해요');
  };

  const accuracy = progress.totalAnswers ? Math.round((progress.correctAnswers / progress.totalAnswers) * 100) : 0;
  const knownPercent = Math.round((progress.known.length / 52) * 100);
  const growthPoints = useMemo<GrowthPoint[]>(() => Object.entries(progress.dailyBest ?? {})
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .slice(-14)
    .map(([date, score]) => ({ date, score })), [progress.dailyBest]);

  const renderMemorize = () => (
    <section className="view memorize-view" aria-labelledby="memorize-title">
      <div className="view-heading compact-heading">
        <div><p className="eyebrow">FLASH SESSION</p><h1 id="memorize-title">오늘도 한 장씩.</h1></div>
        <button className="streak" aria-label={`${progress.streak}일 연속 학습`}><span>●</span>{progress.streak}일</button>
      </div>

      <div className="daily-progress">
        <div><span>오늘 본 카드</span><strong>{progress.studiedToday}장</strong></div>
        <div className="progress-track"><span style={{ width: `${Math.min(100, (progress.studiedToday / 12) * 100)}%` }} /></div>
        <small>하루 12장이면 충분해요</small>
      </div>

      <SegmentedMode value={memorizeMode} onChange={(mode) => { setMemorizeMode(mode); setRevealed(false); }} />

      {!currentCard ? <EmptySession onRestart={() => restartMemorize()} /> : (
        <div className="study-area">
          <div className="study-meta"><span>{MODE_LABELS[currentDirection]}</span><span>{sessionDone + 1} / {sessionDone + queue.length}</span></div>
          <div className="card-stage">
            <span className={`swipe-stamp again ${dragX < -45 ? 'visible' : ''}`}>다시</span>
            <span className={`swipe-stamp got-it ${dragX > 45 ? 'visible' : ''}`}>외웠다</span>
            <button
              className={`study-card ${revealed ? 'is-revealed' : ''} ${dragging ? 'is-dragging' : ''}`}
              style={{ transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)` }}
              onClick={handleStudyCardClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label="플래시 카드를 탭해 정답 확인"
            >
              <span className="prompt-side">
                {currentDirection === 'card-to-number' ? <CardVisual card={currentCard} /> : <span className="number-prompt"><small>STACK NUMBER</small>{currentCard.number}</span>}
                <small className="tap-hint">탭해서 정답 보기</small>
              </span>
              <span className="answer-side">
                {currentDirection === 'card-to-number'
                  ? <span className="number-prompt answer-number"><small>정답</small>{currentCard.number}</span>
                  : <CardVisual card={currentCard} />}
                <small className="tap-hint">밀어서 기억을 기록하세요</small>
              </span>
            </button>
          </div>
          <div className="swipe-actions">
            <button className="again-button" onClick={() => rateCard(false)}><span>←</span><b>아직 헷갈려요</b><small>잠시 뒤 다시</small></button>
            <button className="known-button" onClick={() => rateCard(true)}><b>외웠어요</b><span>→</span><small>다음 카드로</small></button>
          </div>
          <button className="text-button" onClick={() => restartMemorize(true)}>아직 못 외운 카드만 섞기</button>
        </div>
      )}
    </section>
  );

  const rangeStart = learnRange * 13 + 1;
  const rangeEnd = rangeStart + 12;
  const rangeCards = MNEMONICA_STACK.slice(rangeStart - 1, rangeEnd);
  const focused = MNEMONICA_STACK[focusedCard - 1];
  const incrementalTargetCount = Math.min(progress.incrementalMastered + 1, MNEMONICA_STACK.length);
  const incrementalTargetCard = MNEMONICA_STACK[incrementalTargetCount - 1];

  const renderIncrementalLearn = () => {
    if (incrementalStage === 'quiz' && incrementalQuestions.length) {
      const question = incrementalQuestions[incrementalIndex];
      const card = MNEMONICA_STACK[question.cardNumber - 1];
      const isAnswered = incrementalSelected !== null;
      return (
        <section className="view test-question incremental-quiz" aria-labelledby="incremental-quiz-title">
          <div className="quiz-top"><button onClick={() => setLearnView('overview')} aria-label="누적 시험 나가기">×</button><div className="quiz-progress"><span style={{ width: `${((incrementalIndex + 1) / incrementalQuestions.length) * 100}%` }} /></div><b>{incrementalIndex + 1}/{incrementalQuestions.length}</b></div>
          <p className="quiz-mode">누적 시험 · {MODE_LABELS[question.direction]}</p>
          <h1 id="incremental-quiz-title">{question.direction === 'card-to-number' ? '이 카드의 스택 번호는?' : '이 번호에 놓인 카드는?'}</h1>
          <div className="quiz-prompt">{question.direction === 'card-to-number' ? <CardVisual card={card} /> : <span className="number-prompt"><small>STACK NUMBER</small>{question.cardNumber}</span>}</div>
          <div className={`answer-options ${question.direction === 'number-to-card' ? 'card-options' : ''}`}>
            {question.options.map((number) => {
              const optionCard = MNEMONICA_STACK[number - 1];
              const state = isAnswered ? (number === question.cardNumber ? 'correct' : incrementalSelected === number ? 'wrong' : 'muted') : '';
              return <button key={number} className={state} onClick={() => selectIncrementalAnswer(number)} disabled={isAnswered}>
                {question.direction === 'card-to-number' ? <strong>{number}</strong> : <><CardVisual card={optionCard} mini /><span>{optionCard.rank}{optionCard.symbol}</span></>}
              </button>;
            })}
          </div>
          {isAnswered && <div className={`feedback-bar ${incrementalSelected === question.cardNumber ? 'correct' : 'wrong'}`}><div><strong>{incrementalSelected === question.cardNumber ? '정답이에요!' : `정답은 ${question.cardNumber}번`}</strong><span>{card.rank}{card.symbol}</span></div><button onClick={nextIncrementalQuestion}>{incrementalIndex === incrementalQuestions.length - 1 ? '결과 보기' : '다음'} →</button></div>}
        </section>
      );
    }

    if (incrementalStage === 'result' && incrementalQuestions.length) {
      const percent = Math.round((incrementalScore / incrementalQuestions.length) * 100);
      return (
        <section className={`view test-result course-result ${incrementalPerfect ? 'perfect' : ''}`} aria-labelledby="course-result-title">
          <p className="eyebrow">CUMULATIVE TEST</p>
          <div className="score-ring" style={{ '--score': `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}</strong><span>점</span></div></div>
          <h1 id="course-result-title">{incrementalPerfect ? `${incrementalQuestions.length}장 누적 통과!` : '모두 맞을 때까지 한 번 더.'}</h1>
          <p>{incrementalQuestions.length}문제 중 {incrementalScore}개 정답{incrementalPerfect ? ' · 다음 카드를 배울 수 있어요.' : ` · ${incrementalWrong.length}장을 다시 연결해보세요.`}</p>
          <div className="result-stats"><div><span>정답</span><b>{incrementalScore}</b></div><div><span>오답</span><b>{incrementalQuestions.length - incrementalScore}</b></div><div><span>통과 조건</span><b>100%</b></div></div>
          {incrementalPerfect ? (
            <button className="primary-button wide" onClick={continueIncrementalCourse}>{incrementalQuestions.length === MNEMONICA_STACK.length ? '완료 화면 보기' : '다음 카드 배우기'} <span>→</span></button>
          ) : (
            <>
              <button className="primary-button wide" onClick={startIncrementalQuiz}>{incrementalQuestions.length}장 다시 시험보기</button>
              <button className="secondary-button wide" onClick={continueIncrementalCourse}>새 카드 연결 다시 보기</button>
            </>
          )}
          <button className="text-button centered" onClick={() => setLearnView('overview')}>학습 홈으로 나가기</button>
        </section>
      );
    }

    if (progress.incrementalMastered >= MNEMONICA_STACK.length) {
      return (
        <section className="view course-view" aria-labelledby="course-complete-title">
          <div className="course-toolbar"><button onClick={() => setLearnView('overview')}><span>←</span> 학습 홈</button><span>52 / 52 완료</span></div>
          <div className="completion-card course-complete">
            <span className="completion-mark">✓</span>
            <p className="eyebrow">COURSE COMPLETE</p>
            <h2 id="course-complete-title">52장을 모두<br />누적으로 통과했어요.</h2>
            <p>Mnemonica 전체 스택을 한 장씩 쌓아 올렸습니다. 이제 시험 탭에서 52장 전체 기록에 도전해보세요.</p>
            <button className="primary-button" onClick={() => { setLearnView('overview'); setTab('test'); setTestCount(52); }}>52장 시험으로 가기</button>
            <button className={`text-button centered ${incrementalResetArmed ? 'armed' : ''}`} onClick={resetIncrementalCourse}>{incrementalResetArmed ? '정말 처음부터 시작' : '누적 코스 초기화'}</button>
          </div>
        </section>
      );
    }

    return (
      <section className="view course-view" aria-labelledby="incremental-title">
        <div className="course-toolbar"><button onClick={() => setLearnView('overview')}><span>←</span> 학습 홈</button><span>{progress.incrementalMastered} / 52 완료</span></div>
        <div className="course-progress-card">
          <div><span>누적 코스</span><strong>{progress.incrementalMastered}<small>/52</small></strong></div>
          <div className="progress-track"><span style={{ width: `${(progress.incrementalMastered / 52) * 100}%` }} /></div>
          <small>이번 단계를 통과하면 {incrementalTargetCount}장 완료</small>
        </div>
        <div className="teach-panel">
          <p className="eyebrow">CARD {incrementalTargetCount} · NEW</p>
          <h1 id="incremental-title">{incrementalTargetCount}번과 이 카드를<br />하나로 연결하세요.</h1>
          <div className="association-pair">
            <span className="course-number"><small>STACK</small>{incrementalTargetCount}</span>
            <span className="association-arrow">↔</span>
            <div className="incremental-teach-card"><CardVisual card={incrementalTargetCard} /></div>
          </div>
          <p className="association-readout"><strong>{incrementalTargetCount}번</strong><span>은</span><strong className={incrementalTargetCard.suit === 'hearts' || incrementalTargetCard.suit === 'diamonds' ? 'red-suit' : ''}>{incrementalTargetCard.rank}{incrementalTargetCard.symbol}</strong></p>
          <p className="teach-tip">번호와 카드 이름을 소리 내어 3번 읽은 뒤 시험을 시작해보세요.</p>
          <button className="primary-button wide course-start" onClick={startIncrementalQuiz}>지금까지 {incrementalTargetCount}장 시험보기 <span>→</span></button>
        </div>
        {progress.incrementalMastered > 0 && <button className={`text-button centered ${incrementalResetArmed ? 'armed' : ''}`} onClick={resetIncrementalCourse}>{incrementalResetArmed ? '정말 처음부터 시작' : '누적 코스 초기화'}</button>}
      </section>
    );
  };

  const renderLearn = () => {
    if (learnView === 'incremental') return renderIncrementalLearn();
    return (
      <section className="view" aria-labelledby="learn-title">
        <div className="view-heading"><div><p className="eyebrow">LEARN THE ORDER</p><h1 id="learn-title">Mnemonica 익히기</h1></div><span className="round-stat">{knownPercent}%</span></div>
        <p className="view-intro">한 장씩 누적하거나, 13장 구간의 앞뒤 연결을 살펴보세요.</p>

        <section className="incremental-entry" aria-labelledby="incremental-entry-title">
          <div className="course-entry-heading"><span className="course-badge">추천 코스</span><span>{progress.incrementalMastered}/52</span></div>
          <h2 id="incremental-entry-title">1장씩 누적 암기</h2>
          <p>새 카드 1장을 배운 뒤, 지금까지 배운 카드를 모두 맞히면 다음 장이 열립니다.</p>
          <div className="progress-track"><span style={{ width: `${(progress.incrementalMastered / 52) * 100}%` }} /></div>
          <button className="primary-button wide" onClick={() => { setLearnView('incremental'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{progress.incrementalMastered ? '이어서 배우기' : '첫 카드 배우기'} <span>→</span></button>
        </section>

        <div className="section-title learn-section-title"><div><h2>13장씩 연결하기</h2><p>구간과 이웃 카드로 흐름을 익혀요</p></div><span>{knownPercent}%</span></div>
        <div className="range-tabs" aria-label="학습 구간">
          {[0, 1, 2, 3].map((range) => <button key={range} className={learnRange === range ? 'selected' : ''} onClick={() => { setLearnRange(range); setFocusedCard(range * 13 + 1); }}>{range * 13 + 1}–{range * 13 + 13}</button>)}
        </div>

        <div className="focus-chain">
          <p><span>현재 연결</span><strong>{focused.number}번째</strong></p>
          <div className="chain-row">
            {[-1, 0, 1].map((offset) => {
              const item = MNEMONICA_STACK[focused.number - 1 + offset];
              return item ? (
                <button key={item.number} className={offset === 0 ? 'active' : ''} onClick={() => setFocusedCard(item.number)}>
                  <span>{item.number}</span><CardVisual card={item} mini />
                </button>
              ) : <span className="chain-placeholder" key={offset} />;
            })}
          </div>
          <small>앞뒤 카드까지 한 묶음으로 소리 내어 읽어보세요.</small>
        </div>

        <div className="section-title"><div><h2>{rangeStart}–{rangeEnd} 스택</h2><p>카드를 눌러 연결 위치를 바꿔보세요</p></div><span>{rangeCards.filter((card) => progress.known.includes(card.number)).length}/13</span></div>
        <div className="learning-grid">
          {rangeCards.map((card) => (
            <button key={card.number} className={`${focusedCard === card.number ? 'focused' : ''} ${progress.known.includes(card.number) ? 'known' : ''}`} onClick={() => setFocusedCard(card.number)}>
              <span className="stack-number">{card.number}</span>
              <CardVisual card={card} mini />
              <span className="card-code">{card.rank}{card.symbol}</span>
              {progress.known.includes(card.number) && <i>✓</i>}
            </button>
          ))}
        </div>
        <button className="primary-button wide" onClick={() => { setTab('memorize'); setMemorizeMode('number-to-card'); setQueue(shuffle(rangeCards.map((card) => card.number))); setSessionDone(0); setRevealed(false); }}>이 구간 바로 외우기</button>
      </section>
    );
  };

  const renderTestSetup = () => (
    <section className="view" aria-labelledby="test-title">
      <div className="view-heading"><div><p className="eyebrow">QUICK TEST</p><h1 id="test-title">기억을 꺼내볼까요?</h1></div><span className="round-stat">{accuracy}%</span></div>
      <p className="view-intro">정답을 보기 전에 먼저 떠올리는 연습이 암기를 오래 남겨줍니다.</p>
      <div className="test-hero">
        <div className="orbit-card first"><CardVisual card={MNEMONICA_STACK[0]} mini /></div>
        <div className="orbit-card second back-card"><img src="./cards/bicycle_blue.png" alt="Bicycle blue Rider Back" draggable={false} /></div>
        <span>?</span>
      </div>
      <div className="setting-group"><label>출제 방식</label><SegmentedMode value={testMode} onChange={setTestMode} /></div>
      <div className="setting-group"><label>문제 수</label><div className="count-options">{[10, 20, 52].map((count) => <button key={count} className={testCount === count ? 'selected' : ''} onClick={() => setTestCount(count)}><b>{count}</b><span>문제</span></button>)}</div></div>
      <button className="primary-button wide start-test" onClick={() => startTest()}>시험 시작하기 <span>→</span></button>
      {wrongAnswers.length > 0 && <button className="text-button centered" onClick={() => startTest(wrongAnswers)}>직전 오답만 다시 풀기</button>}
    </section>
  );

  const renderTest = () => {
    if (!questions.length) return renderTestSetup();
    if (testComplete) {
      const percent = Math.round((testScore / questions.length) * 100);
      return (
        <section className="view test-result">
          <p className="eyebrow">TEST COMPLETE</p>
          <div className="score-ring" style={{ '--score': `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}</strong><span>점</span></div></div>
          <h1>{percent >= 90 ? '거의 완벽해요.' : percent >= 70 ? '좋은 흐름이에요.' : '틀린 카드가 자라고 있어요.'}</h1>
          <p>{questions.length}문제 중 {testScore}개 정답 · 오답 {wrongAnswers.length}장</p>
          <div className="result-stats"><div><span>정답</span><b>{testScore}</b></div><div><span>오답</span><b>{questions.length - testScore}</b></div><div><span>누적 정확도</span><b>{accuracy}%</b></div></div>
          {wrongAnswers.length > 0 && <button className="primary-button wide" onClick={() => startTest(wrongAnswers)}>오답만 다시 풀기</button>}
          <button className="secondary-button wide" onClick={() => { setQuestions([]); setTestComplete(false); }}>새 시험 만들기</button>
        </section>
      );
    }
    const question = questions[questionIndex];
    const card = MNEMONICA_STACK[question.cardNumber - 1];
    const isAnswered = selectedAnswer !== null;
    return (
      <section className="view test-question">
        <div className="quiz-top"><button onClick={() => setQuestions([])} aria-label="시험 나가기">×</button><div className="quiz-progress"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div><b>{questionIndex + 1}/{questions.length}</b></div>
        <p className="quiz-mode">{MODE_LABELS[question.direction]}</p>
        <h1>{question.direction === 'card-to-number' ? '이 카드의 스택 번호는?' : '이 번호에 놓인 카드는?'}</h1>
        <div className="quiz-prompt">{question.direction === 'card-to-number' ? <CardVisual card={card} /> : <span className="number-prompt"><small>STACK NUMBER</small>{question.cardNumber}</span>}</div>
        <div className={`answer-options ${question.direction === 'number-to-card' ? 'card-options' : ''}`}>
          {question.options.map((number) => {
            const optionCard = MNEMONICA_STACK[number - 1];
            const state = isAnswered ? (number === question.cardNumber ? 'correct' : selectedAnswer === number ? 'wrong' : 'muted') : '';
            return <button key={number} className={state} onClick={() => selectTestAnswer(number)} disabled={isAnswered}>
              {question.direction === 'card-to-number' ? <strong>{number}</strong> : <><CardVisual card={optionCard} mini /><span>{optionCard.rank}{optionCard.symbol}</span></>}
            </button>;
          })}
        </div>
        {isAnswered && <div className={`feedback-bar ${selectedAnswer === question.cardNumber ? 'correct' : 'wrong'}`}><div><strong>{selectedAnswer === question.cardNumber ? '정답이에요!' : `정답은 ${question.cardNumber}번`}</strong><span>{card.rank}{card.symbol}</span></div><button onClick={nextQuestion}>{questionIndex === questions.length - 1 ? '결과 보기' : '다음'} →</button></div>}
      </section>
    );
  };

  const filteredCards = useMemo(() => {
    const query = stackSearch.trim().toUpperCase().replace(/\s/g, '');
    return MNEMONICA_STACK.filter((card) => {
      const matchesSuit = suitFilter === 'all' || card.suit === suitFilter;
      const searchable = `${card.number}${card.code}${card.rank}${card.symbol}`.toUpperCase();
      return matchesSuit && (!query || searchable.includes(query));
    });
  }, [stackSearch, suitFilter]);

  const resetProgress = () => {
    if (!resetArmed) { setResetArmed(true); setTimeout(() => setResetArmed(false), 3000); return; }
    setProgress(DEFAULT_PROGRESS);
    setResetArmed(false);
    showToast('학습 기록을 초기화했어요');
  };

  const renderStack = () => (
    <section className="view" aria-labelledby="stack-title">
      <div className="view-heading"><div><p className="eyebrow">FULL STACK</p><h1 id="stack-title">52장 한눈에 보기</h1></div><span className="round-stat">{progress.known.length}</span></div>
      <div className="stats-strip"><div><span>외운 카드</span><b>{progress.known.length}<small>/52</small></b></div><div><span>연속 학습</span><b>{progress.streak}<small>일</small></b></div><div><span>정답률</span><b>{accuracy}<small>%</small></b></div></div>
      <GrowthChart points={growthPoints} />
      <label className="search-box"><span>⌕</span><input value={stackSearch} onChange={(event) => setStackSearch(event.target.value)} placeholder="번호, 카드 검색 (예: 17, 9H)" /><button onClick={() => setStackSearch('')} aria-label="검색어 지우기">{stackSearch ? '×' : ''}</button></label>
      <div className="suit-filters">
        <button className={suitFilter === 'all' ? 'selected' : ''} onClick={() => setSuitFilter('all')}>전체</button>
        {(Object.keys(SUIT_META) as Suit[]).map((suit) => <button key={suit} className={`${suitFilter === suit ? 'selected' : ''} ${suit === 'hearts' || suit === 'diamonds' ? 'red-suit' : ''}`} onClick={() => setSuitFilter(suit)}>{SUIT_META[suit].symbol}</button>)}
      </div>
      <div className="full-stack-grid">
        {filteredCards.map((card) => (
          <button key={card.number} className={progress.known.includes(card.number) ? 'known' : ''} onClick={() => {
            setProgress((previous) => ({ ...previous, known: previous.known.includes(card.number) ? previous.known.filter((number) => number !== card.number) : [...previous.known, card.number] }));
          }} aria-label={`${card.number}번 ${card.rank}${card.symbol}, 암기 상태 전환`}>
            <span>{card.number}</span><CardVisual card={card} mini />
            {progress.known.includes(card.number) && <i>✓</i>}
          </button>
        ))}
      </div>
      {!filteredCards.length && <div className="no-results"><span>⌕</span><p>찾는 카드가 없어요.</p></div>}
      <div className="reset-panel"><div><strong>기기 안에만 저장돼요</strong><span>로그인 없이 이 브라우저에 학습 기록을 보관합니다.</span></div><button className={resetArmed ? 'armed' : ''} onClick={resetProgress}>{resetArmed ? '정말 초기화' : '기록 초기화'}</button></div>
    </section>
  );

  return (
    <main className="app-shell">
      <div className="brand-bar"><button onClick={() => setTab('memorize')} aria-label="외우기로 이동"><span>M</span><b>MNEMONICA</b></button><span className="brand-dot" /></div>
      {tab === 'memorize' && renderMemorize()}
      {tab === 'learn' && renderLearn()}
      {tab === 'test' && renderTest()}
      {tab === 'stack' && renderStack()}
      <nav className="bottom-nav" aria-label="주요 메뉴">
        {TABS.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span>{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </main>
  );
}
