import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, RotateCcw, Trash2, Pin, PinOff, Info } from "lucide-react";

type Theme = "dark" | "light";
type DrawMode = "full" | "step";
type Accent = "gold" | "blue" | "green";

type PoolConfig = {
  label: string;
  min: number;
  max: number;
  count: number;
};

type GameConfig = {
  key: string;
  name: string;
  pools: PoolConfig[];
  variableCount?: { min: number; max: number; default: number };
};

const GAME_CONFIGS = {
  power: {
    key: "power",
    name: "威力彩",
    pools: [
      { label: "第一區", min: 1, max: 38, count: 6 },
      { label: "第二區", min: 1, max: 8, count: 1 },
    ],
  },
  bingo: {
    key: "bingo",
    name: "Bingo Bingo",
    pools: [{ label: "號碼", min: 1, max: 80, count: 1 }],
    variableCount: { min: 1, max: 10, default: 1 },
  },
  lotto: {
    key: "lotto",
    name: "大樂透",
    pools: [{ label: "號碼", min: 1, max: 49, count: 6 }],
  },
  daily539: {
    key: "daily539",
    name: "今彩539",
    pools: [{ label: "號碼", min: 1, max: 39, count: 5 }],
  },
  t49: {
    key: "t49",
    name: "49台彩",
    pools: [{ label: "號碼", min: 1, max: 49, count: 2 }],
    variableCount: { min: 2, max: 4, default: 2 },
  },
  t39: {
    key: "t39",
    name: "39台彩",
    pools: [{ label: "號碼", min: 1, max: 39, count: 2 }],
    variableCount: { min: 2, max: 4, default: 2 },
  },
} as const satisfies Record<string, GameConfig>;

type GameKey = keyof typeof GAME_CONFIGS;
type DrawPool = { label: string; numbers: number[] };
type StepState = {
  fullSet: DrawPool[];
  poolIndex: number;
  numberIndex: number;
  revealed: DrawPool[];
};
type HistoryEntry = {
  id: number;
  gameKey: GameKey;
  gameName: string;
  result: DrawPool[];
  pinned: boolean;
};

const GAME_KEYS = Object.keys(GAME_CONFIGS) as GameKey[];
const HISTORY_LIMIT = 10;
const TITLE_FONT = '"GenSen Rounded", "Noto Sans TC", sans-serif';

function formatNumber(n: number) {
  return String(n).padStart(2, "0");
}

function range(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function pickUniqueNumbersFromAvailable(available: number[], count: number) {
  if (available.length < count) {
    throw new Error("可用號碼不足，請減少排除號碼或固定號碼。");
  }

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count).sort((a, b) => a - b);
}

function buildPoolNumbers(
  min: number,
  max: number,
  count: number,
  excludedSet: Set<number>,
  forcedSet: Set<number>
) {
  const forced = [...forcedSet].sort((a, b) => a - b);

  if (forced.length > count) {
    throw new Error("固定號碼數量不能超過該玩法的抽取數量。");
  }

  if (forced.some((n) => excludedSet.has(n))) {
    throw new Error("固定號碼不能同時存在於排除名單中。");
  }

  const available = range(min, max).filter(
    (n) => !excludedSet.has(n) && !forcedSet.has(n)
  );
  const randomNeeded = count - forced.length;
  const randomPicked = pickUniqueNumbersFromAvailable(available, randomNeeded);

  return [...forced, ...randomPicked].sort((a, b) => a - b);
}

function buildFullSet(
  gameKey: GameKey,
  excludedByPool: Set<number>[],
  forcedByPool: Set<number>[],
  variableCount: number
): DrawPool[] {
  const config = GAME_CONFIGS[gameKey];

  return config.pools.map((pool, index) => {
    const count =
      index === 0 && "variableCount" in config ? variableCount : pool.count;

    return {
      label: pool.label,
      numbers: buildPoolNumbers(
        pool.min,
        pool.max,
        count,
        excludedByPool[index] ?? new Set<number>(),
        forcedByPool[index] ?? new Set<number>()
      ),
    };
  });
}

function getAccentByGame(gameKey: GameKey): Accent {
  if (gameKey === "bingo") return "blue";
  if (gameKey === "daily539") return "green";
  return "gold";
}

function selfCheck() {
  const forced = new Set<number>([1, 5]);
  const excluded = new Set<number>([2, 3]);
  const pool = buildPoolNumbers(1, 10, 4, excluded, forced);

  if (pool.length !== 4) throw new Error("測試失敗：抽號數量不正確");
  if (!pool.includes(1) || !pool.includes(5)) {
    throw new Error("測試失敗：固定號碼未保留");
  }
  if (pool.some((n) => n === 2 || n === 3)) {
    throw new Error("測試失敗：抽到被排除號碼");
  }

  const powerSet = buildFullSet(
    "power",
    [new Set<number>(), new Set<number>()],
    [new Set<number>(), new Set<number>()],
    1
  );
  if (powerSet[0].numbers.length !== 6 || powerSet[1].numbers.length !== 1) {
    throw new Error("測試失敗：威力彩規格不正確");
  }

  const bingoSet = buildFullSet(
    "bingo",
    [new Set<number>()],
    [new Set<number>([8, 9])],
    5
  );
  if (
    bingoSet[0].numbers.length !== 5 ||
    !bingoSet[0].numbers.includes(8) ||
    !bingoSet[0].numbers.includes(9)
  ) {
    throw new Error("測試失敗：固定號碼整合失敗");
  }
}

selfCheck();

function getThemeClasses(theme: Theme) {
  if (theme === "light") {
    return {
      page: "bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f5f5f4_40%,_#e7e5e4_100%)] text-stone-900",
      card: "border border-stone-300 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
      inner: "border border-stone-300 bg-white/70",
      textMain: "text-stone-900",
      textMuted: "text-stone-700",
      subtle: "text-stone-500",
      button:
        "border border-stone-400 bg-white text-stone-800 hover:bg-stone-100",
      buttonActive: "border border-amber-400 bg-amber-200 text-stone-900",
      danger:
        "border border-red-500 bg-red-500 text-white hover:bg-red-600",
      secondary:
        "border border-stone-400 bg-stone-200 text-stone-900 hover:bg-stone-300",
      resultBox: "border border-stone-300 bg-white/80",
      dashed: "border border-dashed border-stone-400 text-stone-500",
      pill: "border border-stone-400 bg-white text-stone-700 hover:bg-stone-100",
      inputOff:
        "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
      headerGlow:
        "bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.15),_transparent_30%)]",
      pin: "border border-amber-400/60 bg-amber-100 text-amber-900",
      tooltip: "bg-stone-900 text-white",
    };
  }

  return {
    page: "bg-[radial-gradient(circle_at_top,_#3f3f46_0%,_#18181b_36%,_#09090b_100%)] text-white",
    card: "border border-white/10 bg-[rgba(23,23,28,0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
    inner: "border border-white/10 bg-black/20",
    textMain: "text-white",
    textMuted: "text-white/75",
    subtle: "text-white/45",
    button:
      "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
    buttonActive:
      "border border-amber-300/60 bg-amber-300/15 text-amber-100 shadow-[0_12px_30px_rgba(245,158,11,0.12)]",
    danger: "border border-red-700 bg-red-700 text-white hover:bg-red-600",
    secondary:
      "border border-white/10 bg-white/10 text-white hover:bg-white/15",
    resultBox: "border border-white/10 bg-black/20",
    dashed: "border border-dashed border-white/15 text-white/35",
    pill: "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
    inputOff:
      "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
    headerGlow:
      "bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.15),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.05),_transparent_30%)]",
    pin: "border border-amber-300/60 bg-amber-300/15 text-amber-100",
    tooltip: "bg-white text-stone-900",
  };
}

function getBallClasses(highlighted: boolean, accent: Accent) {
  if (highlighted) {
    return "border-red-400 bg-gradient-to-br from-red-300 via-red-400 to-rose-600 text-white shadow-[0_10px_30px_rgba(239,68,68,0.45)]";
  }
  if (accent === "blue") {
    return "border-sky-300 bg-gradient-to-br from-sky-300 via-blue-300 to-blue-600 text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)]";
  }
  if (accent === "green") {
    return "border-emerald-300 bg-gradient-to-br from-emerald-300 via-green-300 to-emerald-600 text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)]";
  }
  return "border-amber-200 bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500 text-stone-900 shadow-[0_10px_30px_rgba(245,158,11,0.35)]";
}

function LuxuryCard({
  children,
  className = "",
  theme,
}: {
  children: React.ReactNode;
  className?: string;
  theme: Theme;
}) {
  const t = getThemeClasses(theme);
  return (
    <div className={`rounded-[28px] border backdrop-blur-xl ${t.card} ${className}`}>
      {children}
    </div>
  );
}

function NumberBall({
  value,
  small = false,
  highlighted = false,
  accent = "gold",
  animationType = "drop",
  delay = 0,
}: {
  value: number;
  small?: boolean;
  highlighted?: boolean;
  accent?: Accent;
  animationType?: "drop" | "roll";
  delay?: number;
}) {
  const initialAnimation =
    animationType === "roll"
      ? { opacity: 0, x: -34, rotate: -220, scale: 0.72 }
      : { opacity: 0, y: -70, scale: 0.72 };

  const animateAnimation =
    animationType === "roll"
      ? { opacity: 1, x: 0, rotate: 0, scale: 1 }
      : { opacity: 1, y: 0, scale: 1 };

  return (
    <motion.div
      initial={initialAnimation}
      animate={animateAnimation}
      transition={{
        type: "spring",
        stiffness: animationType === "roll" ? 220 : 320,
        damping: 19,
        delay,
      }}
      className={`flex items-center justify-center rounded-full border font-black ${
        small ? "h-9 w-9 text-sm" : "h-12 w-12 text-base"
      } ${getBallClasses(highlighted, accent)}`}
      style={{ fontFamily: TITLE_FONT }}
    >
      {formatNumber(value)}
    </motion.div>
  );
}

function LotteryNumberGrid({
  title,
  min,
  max,
  excludedSet,
  forcedSet,
  onToggleExcluded,
  onToggleForced,
  onClearExcluded,
  onClearForced,
  forcedLimit,
  theme,
}: {
  title: string;
  min: number;
  max: number;
  excludedSet: Set<number>;
  forcedSet: Set<number>;
  onToggleExcluded: (value: number) => void;
  onToggleForced: (value: number) => void;
  onClearExcluded: () => void;
  onClearForced: () => void;
  forcedLimit: number;
  theme: Theme;
}) {
  const t = getThemeClasses(theme);
  const values = useMemo(() => range(min, max), [min, max]);

  return (
    <div className={`rounded-[24px] border p-4 ${t.inner}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3
            className={`text-sm font-semibold ${t.textMain}`}
            style={{ fontFamily: TITLE_FONT }}
          >
            {title}
          </h3>
          <div className={`text-xs ${t.subtle}`}>
            已排除 {excludedSet.size} 個號碼｜固定 {forcedSet.size} 個號碼
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClearExcluded}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${t.pill}`}
        >
          清除排除
        </button>
        <button
          type="button"
          onClick={onClearForced}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${t.pill}`}
        >
          清除固定
        </button>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 xl:grid-cols-10">
        {values.map((value) => {
          const excluded = excludedSet.has(value);
          const forced = forcedSet.has(value);
          const forceDisabled = !forced && forcedSet.size >= forcedLimit;

          return (
            <div key={value} className="space-y-1">
              <button
                type="button"
                onClick={() => onToggleExcluded(value)}
                className={`w-full rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                  excluded
                    ? "border-red-950 bg-red-900 text-white shadow-[0_8px_20px_rgba(127,29,29,0.35)]"
                    : t.inputOff
                }`}
                style={{ fontFamily: TITLE_FONT }}
                title="點擊切換排除"
              >
                {formatNumber(value)}
              </button>
              <button
                type="button"
                onClick={() => onToggleForced(value)}
                disabled={forceDisabled}
                className={`w-full rounded-lg border px-1 py-1 text-[11px] font-semibold transition ${
                  forced
                    ? t.buttonActive
                    : `${t.pill} ${forceDisabled ? "cursor-not-allowed opacity-40" : ""}`
                }`}
                style={{ fontFamily: TITLE_FONT }}
                title="點擊切換固定號碼"
              >
                固定
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TooltipInfo({ text, theme }: { text: string; theme: Theme }) {
  const t = getThemeClasses(theme);
  return (
    <div className="group relative inline-flex">
      <Info className={`h-4 w-4 ${t.subtle}`} />
      <div
        className={`pointer-events-none absolute left-1/2 top-6 z-20 hidden w-56 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-lg group-hover:block ${t.tooltip}`}
      >
        {text}
      </div>
    </div>
  );
}

export default function TaiwanLotteryGenerator() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [gameKey, setGameKey] = useState<GameKey>("power");
  const [variableCount, setVariableCount] = useState<number>(1);
  const [drawMode, setDrawMode] = useState<DrawMode>("full");
  const [excludedByGame, setExcludedByGame] = useState<Record<GameKey, Set<number>[]>>({
    power: [new Set<number>(), new Set<number>()],
    bingo: [new Set<number>()],
    lotto: [new Set<number>()],
    daily539: [new Set<number>()],
    t49: [new Set<number>()],
    t39: [new Set<number>()],
  });
  const [forcedByGame, setForcedByGame] = useState<Record<GameKey, Set<number>[]>>({
    power: [new Set<number>(), new Set<number>()],
    bingo: [new Set<number>()],
    lotto: [new Set<number>()],
    daily539: [new Set<number>()],
    t49: [new Set<number>()],
    t39: [new Set<number>()],
  });
  const [currentDraw, setCurrentDraw] = useState<DrawPool[]>([]);
  const [stepState, setStepState] = useState<StepState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState<string>(
    "請先選擇模式、固定號碼與排除號碼，再開始抽號碼。"
  );

  const config = GAME_CONFIGS[gameKey];
  const excludedByPool = excludedByGame[gameKey];
  const forcedByPool = forcedByGame[gameKey];
  const currentAccent = getAccentByGame(gameKey);
  const currentAnimationType = drawMode === "step" ? "roll" : "drop";
  const t = getThemeClasses(theme);

  useEffect(() => {
    if ("variableCount" in config) {
      setVariableCount(config.variableCount.default);
    }
  }, [config]);

  const resetCurrentProgress = (customMessage?: string) => {
    setCurrentDraw([]);
    setStepState(null);
    setMessage(customMessage || "已重設目前結果。可以重新開始抽號碼。");
  };

  const switchGame = (nextKey: GameKey) => {
    const nextConfig = GAME_CONFIGS[nextKey];
    setGameKey(nextKey);
    setDrawMode("full");
    if ("variableCount" in nextConfig) {
      setVariableCount(nextConfig.variableCount.default);
    }
    resetCurrentProgress(`已切換到 ${nextConfig.name}。`);
  };

  const getPoolDrawCount = (poolIndex: number) => {
    const pool = config.pools[poolIndex];
    return poolIndex === 0 && "variableCount" in config
      ? variableCount
      : pool.count;
  };

  const toggleExcluded = (poolIndex: number, value: number) => {
    setExcludedByGame((prev) => {
      const nextState = { ...prev };
      nextState[gameKey] = prev[gameKey].map((set, index) => {
        const next = new Set(set);
        if (index === poolIndex) {
          next.has(value) ? next.delete(value) : next.add(value);
        }
        return next;
      });
      return nextState;
    });

    setForcedByGame((prev) => {
      const nextState = { ...prev };
      nextState[gameKey] = prev[gameKey].map((set, index) => {
        const next = new Set(set);
        if (index === poolIndex && next.has(value)) next.delete(value);
        return next;
      });
      return nextState;
    });

    resetCurrentProgress("已更新排除號碼，請重新抽號碼。");
  };

  const toggleForced = (poolIndex: number, value: number) => {
    const limit = getPoolDrawCount(poolIndex);

    setForcedByGame((prev) => {
      const nextState = { ...prev };
      nextState[gameKey] = prev[gameKey].map((set, index) => {
        const next = new Set(set);
        if (index === poolIndex) {
          if (next.has(value)) next.delete(value);
          else if (next.size < limit) next.add(value);
        }
        return next;
      });
      return nextState;
    });

    setExcludedByGame((prev) => {
      const nextState = { ...prev };
      nextState[gameKey] = prev[gameKey].map((set, index) => {
        const next = new Set(set);
        if (index === poolIndex && next.has(value)) next.delete(value);
        return next;
      });
      return nextState;
    });

    resetCurrentProgress("已更新固定號碼，請重新抽號碼。");
  };

  const clearExcluded = (poolIndex: number) => {
    setExcludedByGame((prev) => {
      const nextState = { ...prev };
      nextState[gameKey] = prev[gameKey].map((set, index) =>
        index === poolIndex ? new Set<number>() : new Set(set)
      );
      return nextState;
    });
    resetCurrentProgress("已清除此區排除號碼。");
  };

  const clearForced = (poolIndex: number) => {
    setForcedByGame((prev) => {
      const nextState = { ...prev };
      nextState[gameKey] = prev[gameKey].map((set, index) =>
        index === poolIndex ? new Set<number>() : new Set(set)
      );
      return nextState;
    });
    resetCurrentProgress("已清除此區固定號碼。");
  };

  const pushHistory = (entry: Omit<HistoryEntry, "pinned">) => {
    setHistory((prev) => {
      const existingPinned = prev.filter((item) => item.pinned);
      const existingUnpinned = prev.filter((item) => !item.pinned);
      const newEntry: HistoryEntry = { ...entry, pinned: false };
      const nextUnpinned = [newEntry, ...existingUnpinned].slice(
        0,
        Math.max(0, HISTORY_LIMIT - existingPinned.length)
      );
      return [...existingPinned, ...nextUnpinned];
    });
  };

  const drawWholeSet = () => {
    try {
      const result = buildFullSet(
        gameKey,
        excludedByPool,
        forcedByPool,
        variableCount
      );
      setCurrentDraw(result);
      setStepState(null);
      setMessage("已產生一整組號碼。");
      pushHistory({ id: Date.now(), gameKey, gameName: config.name, result });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "抽號失敗");
    }
  };

  const drawStep = () => {
    try {
      let nextState = stepState;

      if (!nextState) {
        const fullSet = buildFullSet(
          gameKey,
          excludedByPool,
          forcedByPool,
          variableCount
        );
        nextState = {
          fullSet,
          poolIndex: 0,
          numberIndex: 0,
          revealed: fullSet.map((pool) => ({ label: pool.label, numbers: [] })),
        };
      }

      const { fullSet, poolIndex, numberIndex, revealed } = nextState;
      const nextRevealed = revealed.map((pool) => ({
        label: pool.label,
        numbers: [...pool.numbers],
      }));

      nextRevealed[poolIndex].numbers.push(
        fullSet[poolIndex].numbers[numberIndex]
      );
      setCurrentDraw(nextRevealed);

      const isLastNumber =
        poolIndex === fullSet.length - 1 &&
        numberIndex === fullSet[poolIndex].numbers.length - 1;

      if (isLastNumber) {
        setStepState(null);
        setMessage("已完成這一組號碼。");
        pushHistory({
          id: Date.now(),
          gameKey,
          gameName: config.name,
          result: fullSet,
        });
        return;
      }

      let nextPoolIndex = poolIndex;
      let nextNumberIndex = numberIndex + 1;

      if (nextNumberIndex >= fullSet[poolIndex].numbers.length) {
        nextPoolIndex += 1;
        nextNumberIndex = 0;
      }

      setStepState({
        fullSet,
        poolIndex: nextPoolIndex,
        numberIndex: nextNumberIndex,
        revealed: nextRevealed,
      });
      setMessage("已抽出一個號碼，再按一次可繼續。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "抽號失敗");
    }
  };

  const handleDraw = () => {
    const pinnedCount = history.filter((item) => item.pinned).length;
    const unpinnedCount = history.length - pinnedCount;

    if (
      unpinnedCount >= Math.max(0, HISTORY_LIMIT - pinnedCount) &&
      !stepState
    ) {
      setMessage(
        `未釘選紀錄已達上限 ${HISTORY_LIMIT}，請清空或釘選後再繼續。`
      );
      return;
    }

    drawMode === "full" ? drawWholeSet() : drawStep();
  };

  const togglePinHistory = (id: number) => {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      )
    );
  };

  const clearAllPins = () => {
    setHistory((prev) => prev.map((item) => ({ ...item, pinned: false })));
  };

  return (
    <div
      className={`min-h-screen p-4 md:p-8 ${t.page}`}
      style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <LuxuryCard theme={theme} className="overflow-hidden p-0">
          <div className="relative p-6 md:p-8">
            <div className={`absolute inset-0 ${t.headerGlow}`} />

            <img
              src={`${import.meta.env.BASE_URL}Lear.png`}
              alt="Lear background"
              className="pointer-events-none select-none absolute bottom-0 right-2 hidden h-[220px] w-auto object-contain opacity-[0.12] md:block"
            />

            <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <h1
                  className={`text-3xl font-black tracking-wide md:text-5xl ${t.textMain}`}
                  style={{ fontFamily: TITLE_FONT }}
                >
                  台灣樂透號碼隨機產生器
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-red-500 md:text-sm">
                  ⚠️ 風險提示：本網站僅提供隨機號碼生成服務，結果不具任何中獎保證。
                  <br />
                  請依自身經濟能力理性投注，避免過度投入。
                  <br />
                  彩券屬於機率性活動，請以娛樂心態參與，切勿沉迷。
                </p>
                <p
                  className={`mt-4 max-w-3xl text-sm leading-7 md:text-base ${t.textMuted}`}
                >
                  支援威力彩、Bingo Bingo、大樂透、今彩539、49台彩、39台彩。可自由排除號碼、固定一定要抽出的號碼，並以單顆滾動或整組掉落的方式抽出結果。
                </p>
              </div>

              <div className="relative z-10 flex flex-col items-end gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                  }
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold ${t.button}`}
                  style={{ fontFamily: TITLE_FONT }}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {theme === "dark" ? "切換一般模式" : "切換深夜模式"}
                </button>

                <img
                  src={`${import.meta.env.BASE_URL}Lear.png`}
                  alt="Lear"
                  className="hidden h-20 w-auto object-contain opacity-90 drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] md:block"
                />
              </div>
            </div>
          </div>
        </LuxuryCard>

        <LuxuryCard theme={theme} className="p-5 md:p-6">
          <h2
            className={`mb-4 text-lg font-bold ${t.textMain}`}
            style={{ fontFamily: TITLE_FONT }}
          >
            第一步：選擇模式
          </h2>

          <div className="flex flex-wrap gap-3">
            {GAME_KEYS.map((key) => {
              const active = key === gameKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchGame(key)}
                  className={`rounded-2xl border px-4 py-3 font-bold transition ${
                    active ? t.buttonActive : t.button
                  }`}
                  style={{ fontFamily: TITLE_FONT }}
                >
                  {GAME_CONFIGS[key].name}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {"variableCount" in config ? (
              <div>
                <div className={`mb-2 text-sm font-semibold ${t.textMain}`}>
                  選擇抽取數量
                </div>
                <div className="flex flex-wrap gap-2">
                  {range(config.variableCount.min, config.variableCount.max).map(
                    (count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setVariableCount(count);
                          resetCurrentProgress(`已設定為抽出 ${count} 個號碼。`);
                        }}
                        className={`rounded-xl px-4 py-2 text-sm font-bold ${
                          variableCount === count ? t.buttonActive : t.button
                        }`}
                        style={{ fontFamily: TITLE_FONT }}
                      >
                        {count} 個
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className={`text-sm ${t.subtle}`}>此模式的抽號數量固定。</div>
            )}

            <div>
              <div className={`mb-2 text-sm font-semibold ${t.textMain}`}>
                抽號方式
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrawMode("step");
                    resetCurrentProgress("已切換為一次抽一個號碼。");
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                    drawMode === "step" ? t.buttonActive : t.button
                  }`}
                  style={{ fontFamily: TITLE_FONT }}
                >
                  一次出現一個號碼
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawMode("full");
                    resetCurrentProgress("已切換為一次抽一整組號碼。");
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                    drawMode === "full" ? t.buttonActive : t.button
                  }`}
                  style={{ fontFamily: TITLE_FONT }}
                >
                  一次出現一組號碼
                </button>
              </div>
            </div>
          </div>
        </LuxuryCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <LuxuryCard theme={theme} className="p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                className={`text-lg font-bold ${t.textMain}`}
                style={{ fontFamily: TITLE_FONT }}
              >
                第二步：設定固定與排除號碼
              </h2>
              <div className={`text-xs ${t.subtle}`}>
                固定號碼不可超過抽取數量，且不可同時排除
              </div>
            </div>

            <div className="space-y-4">
              {config.pools.map((pool, poolIndex) => (
                <LotteryNumberGrid
                  key={`${config.key}-${pool.label}`}
                  title={`${pool.label}（${formatNumber(pool.min)} ~ ${formatNumber(
                    pool.max
                  )}）`}
                  min={pool.min}
                  max={pool.max}
                  excludedSet={excludedByPool[poolIndex]}
                  forcedSet={forcedByPool[poolIndex]}
                  onToggleExcluded={(value) => toggleExcluded(poolIndex, value)}
                  onToggleForced={(value) => toggleForced(poolIndex, value)}
                  onClearExcluded={() => clearExcluded(poolIndex)}
                  onClearForced={() => clearForced(poolIndex)}
                  forcedLimit={getPoolDrawCount(poolIndex)}
                  theme={theme}
                />
              ))}
            </div>
          </LuxuryCard>

          <LuxuryCard theme={theme} className="p-5 md:p-6">
            <h2
              className={`mb-4 text-lg font-bold ${t.textMain}`}
              style={{ fontFamily: TITLE_FONT }}
            >
              第三步：抽號結果
            </h2>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDraw}
                className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-500 px-4 py-2 text-sm font-black text-stone-900 shadow-[0_12px_30px_rgba(245,158,11,0.28)]"
                style={{ fontFamily: TITLE_FONT }}
              >
                {drawMode === "step" ? "抽下一個號碼" : "抽一整組"}
              </button>

              <button
                type="button"
                onClick={() => resetCurrentProgress()}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold ${t.secondary}`}
                style={{ fontFamily: TITLE_FONT }}
              >
                <RotateCcw className="h-4 w-4" />
                重設目前結果
              </button>
            </div>

            <div
              className={`mb-4 rounded-[22px] border p-3 text-sm ${t.resultBox} ${t.textMuted}`}
            >
              {message}
            </div>

            <div className="space-y-4">
              {currentDraw.length === 0 ? (
                <div
                  className={`rounded-[22px] border border-dashed p-8 text-center text-sm ${t.dashed}`}
                >
                  尚未產生結果
                </div>
              ) : (
                currentDraw.map((pool, poolIndex) => (
                  <motion.div
                    key={`${pool.label}-${poolIndex}-${pool.numbers.join("-")}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-[24px] border p-4 ${t.resultBox}`}
                  >
                    <div
                      className={`mb-3 text-sm font-semibold ${t.textMuted}`}
                      style={{ fontFamily: TITLE_FONT }}
                    >
                      {pool.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pool.numbers.map((value, index) => (
                        <NumberBall
                          key={`${pool.label}-${value}-${index}`}
                          value={value}
                          highlighted={
                            config.pools.length === 2 && poolIndex === 1
                          }
                          accent={currentAccent}
                          animationType={currentAnimationType}
                          delay={drawMode === "full" ? index * 0.08 : 0}
                        />
                      ))}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </LuxuryCard>
        </div>

        <LuxuryCard theme={theme} className="p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`text-lg font-bold ${t.textMain}`}
                  style={{ fontFamily: TITLE_FONT }}
                >
                  第四步：歷史紀錄
                </h2>
                <TooltipInfo
                  text="釘選後，清除歷史紀錄將無法清除被釘選之紀錄。"
                  theme={theme}
                />
              </div>
              <div className={`text-xs ${t.subtle}`}>
                最多保留 {HISTORY_LIMIT} 組，釘選項目會優先保留
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearAllPins}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold ${t.secondary}`}
                style={{ fontFamily: TITLE_FONT }}
              >
                <PinOff className="h-4 w-4" />
                取消全部釘選
              </button>

              <button
                type="button"
                onClick={() =>
                  setHistory((prev) => prev.filter((item) => item.pinned))
                }
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold ${t.danger}`}
                style={{ fontFamily: TITLE_FONT }}
              >
                <Trash2 className="h-4 w-4" />
                清空歷史紀錄
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {history.length === 0 ? (
              <div
                className={`rounded-[22px] border border-dashed p-8 text-center text-sm ${t.dashed}`}
              >
                尚無紀錄
              </div>
            ) : (
              history.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className={`rounded-[24px] border p-4 ${
                    item.pinned ? t.pin : t.resultBox
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div
                        className={`font-bold ${t.textMain}`}
                        style={{ fontFamily: TITLE_FONT }}
                      >
                        {item.gameName}
                      </div>
                      <div className={`text-xs ${t.subtle}`}>
                        第 {history.length - index} 組{" "}
                        {item.pinned ? "・已釘選" : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePinHistory(item.id)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                        item.pinned ? t.buttonActive : t.button
                      }`}
                      style={{ fontFamily: TITLE_FONT }}
                    >
                      <Pin className="h-4 w-4" />
                      {item.pinned ? "取消釘選" : "釘選"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {item.result.map((pool, poolIndex) => (
                      <div key={`${item.id}-${pool.label}`}>
                        <div className={`mb-1 text-xs font-medium ${t.subtle}`}>
                          {pool.label}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pool.numbers.map((num, numIndex) => (
                            <NumberBall
                              key={`${item.id}-${pool.label}-${num}-${numIndex}`}
                              value={num}
                              small
                              highlighted={
                                item.gameKey === "power" && poolIndex === 1
                              }
                              accent={getAccentByGame(item.gameKey)}
                              animationType="drop"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </LuxuryCard>

        <LuxuryCard theme={theme} className="p-5 md:p-6">
          <details>
            <summary
              className={`cursor-pointer text-lg font-bold ${t.textMain}`}
              style={{ fontFamily: TITLE_FONT }}
            >
              快速說明
            </summary>
            <ul className={`mt-4 space-y-2 text-sm ${t.textMuted}`}>
              <li>• 可設定固定號碼與排除號碼，固定號碼一定會被抽出。</li>
              <li>• 固定號碼不能超過該玩法的抽取數量，且不能同時排除。</li>
              <li>• 釘選後，清除歷史紀錄將無法清除被釘選之紀錄。</li>
              <li>• 威力彩：第一區 6 個號碼，第二區 1 個號碼。</li>
              <li>• Bingo Bingo：01~80 可自選抽 1 到 10 個不重複號碼。</li>
              <li>• 大樂透：01~49 隨機開出 6 個號碼。</li>
              <li>• 今彩539：01~39 隨機開出 5 個號碼。</li>
              <li>• 49台彩 / 39台彩：可自選抽 2、3、4 個不重複號碼。</li>
            </ul>
          </details>
        </LuxuryCard>

        <div
          className={`pb-4 text-center text-xs ${t.subtle}`}
          style={{ fontFamily: TITLE_FONT }}
        >
          © 2026 Lear. All Rights Reserved.
        </div>
      </div>
    </div>
  );
}