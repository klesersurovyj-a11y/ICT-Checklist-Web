/* ICT Checklist — desktop web app */

'use strict';

/* =========================================================
   1. Модель данных
   ========================================================= */

const STORAGE_KEY = 'ict-checklist-web-v1';

const STEPS = [
  { key: 'news', num: 1, title: 'NEWS', group: 'Открытие' },
  { key: 'risk', num: 2, title: 'RISK', group: 'Открытие' },
  { key: 'ofsof', num: 3, title: 'OF / SOF', group: 'Открытие' },
  { key: 'trendW1', num: 4, title: 'TREND W1', group: 'Структура' },
  { key: 'lastDR', num: 5, title: 'LAST DR W1', group: 'Структура' },
  { key: 'premiumDiscount', num: 6, title: 'PREMIUM / DISCOUNT', group: 'Структура' },
  { key: 'keyLevels', num: 7, title: 'KEY LEVELS', group: 'Структура' },
  { key: 'keyLevelToPointA', num: 8, title: 'KEY LEVEL → POINT A', group: 'Сценарий' },
  { key: 'pointA', num: 9, title: 'POINT A D1', group: 'Сценарий' },
  { key: 'pointB', num: 10, title: 'POINT B D1', group: 'Сценарий' },
  { key: 'testA', num: 11, title: 'TEST A', group: 'Подтверждение' },
  { key: 'reaction', num: 12, title: 'REACTION H4', group: 'Подтверждение' },
  { key: 'slowdown', num: 13, title: 'SLOWDOWN H1', group: 'Подтверждение' },
  { key: 'fractals', num: 14, title: 'FRACTALS H1', group: 'Подтверждение' },
  { key: 'snr', num: 15, title: 'SNR', group: 'Подтверждение' },
  { key: 'test', num: 16, title: 'TEST', group: 'Подтверждение' },
  { key: 'rr', num: 17, title: 'RR', group: 'Вход' },
  { key: 'symbol', num: 18, title: 'SYMBOL', group: 'Вход' },
  { key: 'entry', num: 19, title: 'ENTRY', group: 'Вход' }
];

const CONFIRM_STEPS = ['testA', 'reaction', 'slowdown', 'fractals', 'snr', 'test'];

const LEVEL_TYPES = [
  { key: 'SNR', color: '#7c6bff' },
  { key: 'FVG', color: '#ffb65c' },
  { key: 'Fractal', color: '#43d8a0' },
  { key: '0.5 DR', color: '#b9aeff' }
];

const POINT_B_TYPES = ['Fractal', 'FVG коррекции', 'Граница диапазона'];

const MOODS = [
  { key: 'calm', label: 'Спокойно', color: '#43d8a0' },
  { key: 'confident', label: 'Уверенно', color: '#7c6bff' },
  { key: 'doubt', label: 'Сомневался', color: '#ffb65c' },
  { key: 'rush', label: 'Спешил', color: '#ff6b6b' }
];

function defaultDB() {
  return {
    version: 1,
    settings: {
      symbols: ['EURUSD', 'GBPUSD', 'XAUUSD'],
      minRR: 2,
      ladder: [12, 25, 50],
      cycleStart: '19:00',
      cycleEnd: '22:00',
      limits: { enabled: false, maxLossR: 2, maxTrades: 2 }
    },
    cycles: [],
    trades: [],
    ladder: { step: 0, accR: 0 },
    goals: {}
  };
}

let db = loadDB();
let ui = {
  view: 'today',
  period: 'all',
  tradeFilter: 'all',
  search: '',
  levelType: 'all',
  onlyActive: false,
  calendarMonth: firstOfMonthISO(new Date()),
  selectedDay: null,
  goalDraft: null
};

/* =========================================================
   2. Хранение
   ========================================================= */

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    return normalizeDB(parsed);
  } catch (err) {
    return defaultDB();
  }
}

function normalizeDB(input) {
  const base = defaultDB();
  const out = Object.assign(base, input || {});
  out.settings = Object.assign(base.settings, (input && input.settings) || {});
  out.settings.limits = Object.assign(
    base.settings.limits,
    (input && input.settings && input.settings.limits) || {}
  );
  if (!Array.isArray(out.settings.symbols) || !out.settings.symbols.length) {
    out.settings.symbols = base.settings.symbols;
  }
  if (!Array.isArray(out.settings.ladder) || out.settings.ladder.length !== 3) {
    out.settings.ladder = base.settings.ladder;
  }
  if (!Array.isArray(out.cycles)) out.cycles = [];
  if (!Array.isArray(out.trades)) out.trades = [];
  if (!out.goals || typeof out.goals !== 'object') out.goals = {};
  if (!out.ladder || typeof out.ladder !== 'object') out.ladder = { step: 0, accR: 0 };
  return out;
}

let saveTimer = null;

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (err) {
      /* хранилище недоступно — работаем в памяти */
    }
  }, 120);
}

function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    /* noop */
  }
}

/* =========================================================
   3. Утилиты
   ========================================================= */

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  if (value === '' || value == null) return null;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

function round(value, digits) {
  const factor = Math.pow(10, digits == null ? 2 : digits);
  return Math.round(value * factor) / factor;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoDate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function todayISO() {
  return isoDate(new Date());
}

function dateFromISO(iso) {
  if (!iso) return new Date();
  const parts = String(iso).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
}

function firstOfMonthISO(date) {
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthKey(iso) {
  return String(iso || '').slice(0, 7);
}

function addMonthsISO(iso, delta) {
  const date = dateFromISO(iso);
  return firstOfMonthISO(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

function fmtDay(iso) {
  const d = dateFromISO(iso);
  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
}

function fmtMonthTitle(iso) {
  const d = dateFromISO(iso);
  return MONTHS_NOM[d.getMonth()] + ' ' + d.getFullYear();
}

function fmtMonthName(iso) {
  const d = dateFromISO(iso);
  return MONTHS_NOM[d.getMonth()];
}

function weekdayIndex(iso) {
  const d = dateFromISO(iso);
  return (d.getDay() + 6) % 7;
}

function fmtPrice(value) {
  if (value == null || value === '' || isNaN(Number(value))) return '—';
  const number = Number(value);
  if (number === Math.round(number)) return String(number);
  return String(round(number, 5));
}

function fmtMoney(value) {
  if (value == null || isNaN(Number(value))) return '—';
  const number = Number(value);
  const digits = number === Math.round(number) ? 0 : 2;
  return '$' + number.toFixed(digits);
}

function fmtR(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 0.05) return '0.0R';
  const sign = number > 0 ? '+' : '\u2212';
  return sign + Math.abs(number).toFixed(1) + 'R';
}

function fmtSigned(value, digits) {
  const number = Number(value) || 0;
  const d = digits == null ? 1 : digits;
  if (Math.abs(number) < (d === 1 ? 0.05 : 0.005)) return (0).toFixed(d);
  return (number > 0 ? '+' : '\u2212') + Math.abs(number).toFixed(d);
}

function fmtPlainR(value) {
  const number = Number(value) || 0;
  const sign = number < -0.05 ? '\u2212' : '';
  return sign + Math.abs(number).toFixed(1) + 'R';
}

function fmtPercent(value) {
  return Math.round((Number(value) || 0) * 100) + '%';
}

function rClass(value) {
  const number = Number(value) || 0;
  if (number > 0.05) return 'positive';
  if (number < -0.05) return 'negative';
  return 'muted';
}

function colorForR(value) {
  const number = Number(value) || 0;
  if (number > 0.05) return '#43d8a0';
  if (number < -0.05) return '#ff6b6b';
  return 'rgba(242,243,247,0.5)';
}

function levelColor(type) {
  const found = LEVEL_TYPES.find(function (item) {
    return item.key === type;
  });
  return found ? found.color : '#7c6bff';
}

function dealsWord(count) {
  const n = Math.abs(count) % 100;
  const k = Math.abs(count) % 10;
  if (n >= 11 && n <= 14) return count + ' сделок';
  if (k === 1) return count + ' сделка';
  if (k >= 2 && k <= 4) return count + ' сделки';
  return count + ' сделок';
}

function daysWord(count) {
  const n = Math.abs(count) % 100;
  const k = Math.abs(count) % 10;
  if (n >= 11 && n <= 14) return count + ' торговых дней';
  if (k === 1) return count + ' торговый день';
  if (k >= 2 && k <= 4) return count + ' торговых дня';
  return count + ' торговых дней';
}

function closeTime(trade) {
  return new Date(trade.closedAt || trade.entryDate || 0).getTime();
}

/* =========================================================
   4. Движок Risk Ladder
   ========================================================= */

function recomputeLadder() {
  const closed = db.trades
    .filter(function (t) {
      return t.result !== 'open';
    })
    .slice()
    .sort(function (a, b) {
      return closeTime(a) - closeTime(b);
    });

  let step = 0;
  let acc = 0;

  closed.forEach(function (trade) {
    const r = Number(trade.actualR) || 0;
    if (r > 0.05) {
      acc += r;
      if (acc >= 2 - 1e-9) {
        if (step < 2) step += 1;
        acc = 0;
      }
    } else if (r < -0.05) {
      acc = 0;
      step = 0;
    }
  });

  db.ladder = { step: step, accR: round(acc, 4) };
}

function ladderAmount(step) {
  const ladder = db.settings.ladder;
  const fallback = [12, 25, 50];
  const index = Math.max(0, Math.min(Number(step) || 0, ladder.length - 1));
  const value = Number(ladder[index]);
  return value > 0 ? value : fallback[index];
}

/* =========================================================
   5. Расчёты статистики
   ========================================================= */

function closedTrades() {
  return db.trades.filter(function (t) {
    return t.result !== 'open';
  });
}

function inPeriod(iso, period) {
  if (period === 'all') return true;
  const today = dateFromISO(todayISO()).getTime();
  const date = dateFromISO(iso).getTime();
  if (period === 'today') return iso === todayISO();
  if (period === 'week') return date >= today - 6 * 86400000 && date <= today;
  return true;
}

function periodTrades(period) {
  return closedTrades()
    .filter(function (trade) {
      return inPeriod(trade.tradeDay, period);
    })
    .sort(function (a, b) {
      return closeTime(a) - closeTime(b);
    });
}

function groupStats(trades) {
  let wins = 0;
  let losses = 0;
  let be = 0;
  let totalR = 0;
  trades.forEach(function (trade) {
    const r = Number(trade.actualR) || 0;
    totalR += r;
    if (r > 0.05) wins += 1;
    else if (r < -0.05) losses += 1;
    else be += 1;
  });
  return {
    count: trades.length,
    wins: wins,
    losses: losses,
    be: be,
    totalR: totalR,
    winRate: trades.length ? wins / trades.length : 0
  };
}

function streaks(trades) {
  let best = { count: 0, totalR: 0 };
  let worst = { count: 0, totalR: 0 };
  let winRun = 0;
  let winRunR = 0;
  let lossRun = 0;
  let lossRunR = 0;

  trades.forEach(function (trade) {
    const r = Number(trade.actualR) || 0;
    if (r > 0.05) {
      winRun += 1;
      winRunR += r;
      lossRun = 0;
      lossRunR = 0;
      if (winRun > best.count || (winRun === best.count && winRunR > best.totalR)) {
        best = { count: winRun, totalR: winRunR };
      }
    } else if (r < -0.05) {
      lossRun += 1;
      lossRunR += r;
      winRun = 0;
      winRunR = 0;
      if (lossRun > worst.count || (lossRun === worst.count && lossRunR < worst.totalR)) {
        worst = { count: lossRun, totalR: lossRunR };
      }
    } else {
      winRun = 0;
      winRunR = 0;
      lossRun = 0;
      lossRunR = 0;
    }
  });

  return { best: best, worst: worst };
}

function buildStats(period) {
  const trades = periodTrades(period);
  const summary = groupStats(trades);

  const bySymbol = {};
  const byDirection = {};
  const byStep = { 0: [], 1: [], 2: [] };
  const byWeekday = [[], [], [], [], [], [], []];
  const byHour = {};
  const byTag = {};

  trades.forEach(function (trade) {
    if (!bySymbol[trade.symbol]) bySymbol[trade.symbol] = [];
    bySymbol[trade.symbol].push(trade);

    if (!byDirection[trade.direction]) byDirection[trade.direction] = [];
    byDirection[trade.direction].push(trade);

    const step = Math.max(0, Math.min(2, Number(trade.ladderStep) || 0));
    byStep[step].push(trade);

    byWeekday[weekdayIndex(trade.tradeDay)].push(trade);

    const hour = new Date(trade.entryDate).getHours();
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(trade);

    (trade.tags || []).forEach(function (tag) {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(trade);
    });
  });

  const symbolGroups = Object.keys(bySymbol)
    .map(function (symbol) {
      return Object.assign({ title: symbol }, groupStats(bySymbol[symbol]));
    })
    .sort(function (a, b) {
      if (a.count !== b.count) return b.count - a.count;
      return b.totalR - a.totalR;
    });

  const directionGroups = ['LONG', 'SHORT'].map(function (direction) {
    return Object.assign({ title: direction }, groupStats(byDirection[direction] || []));
  });

  const stepGroups = [0, 1, 2].map(function (index) {
    return Object.assign(
      { title: fmtMoney(db.settings.ladder[index]), index: index },
      groupStats(byStep[index] || [])
    );
  });

  const weekdayGroups = WEEKDAYS.map(function (label, index) {
    return Object.assign({ title: label, index: index }, groupStats(byWeekday[index]));
  });

  const hourGroups = Object.keys(byHour)
    .map(function (hour) {
      return Object.assign({ title: pad2(hour) + ':00', hour: Number(hour) }, groupStats(byHour[hour]));
    })
    .sort(function (a, b) {
      return a.hour - b.hour;
    });

  const tagGroups = Object.keys(byTag)
    .map(function (tag) {
      return Object.assign({ title: tag }, groupStats(byTag[tag]));
    })
    .sort(function (a, b) {
      if (a.count !== b.count) return b.count - a.count;
      return b.totalR - a.totalR;
    });

  const grossWin = trades
    .filter(function (t) {
      return t.actualR > 0;
    })
    .reduce(function (sum, t) {
      return sum + t.actualR;
    }, 0);

  const grossLoss = Math.abs(
    trades
      .filter(function (t) {
        return t.actualR < 0;
      })
      .reduce(function (sum, t) {
        return sum + t.actualR;
      }, 0)
  );

  const chartPoints = [];
  let running = 0;
  trades.forEach(function (trade) {
    running += Number(trade.actualR) || 0;
    chartPoints.push({ value: running, risk: Number(trade.riskUSD) || 0, day: trade.tradeDay });
  });

  return {
    trades: trades,
    count: summary.count,
    wins: summary.wins,
    losses: summary.losses,
    totalR: summary.totalR,
    winRate: summary.winRate,
    averageR: trades.length ? summary.totalR / trades.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    streaks: streaks(trades),
    bySymbol: symbolGroups,
    byDirection: directionGroups,
    byStep: stepGroups,
    byWeekday: weekdayGroups,
    byHour: hourGroups,
    byTag: tagGroups,
    chart: chartPoints
  };
}

/* =========================================================
   6. Производные данные дня и лимитов
   ========================================================= */

function tradesOfDay(iso) {
  return db.trades.filter(function (trade) {
    return trade.tradeDay === iso;
  });
}

function dayR(iso) {
  return tradesOfDay(iso)
    .filter(function (trade) {
      return trade.result !== 'open';
    })
    .reduce(function (sum, trade) {
      return sum + (Number(trade.actualR) || 0);
    }, 0);
}

function limitsState() {
  const limits = db.settings.limits;
  const maxTrades = Number(limits.maxTrades) > 0 ? Number(limits.maxTrades) : 2;
  const maxLoss = Number(limits.maxLossR) > 0 ? Number(limits.maxLossR) : 2;
  const trades = tradesOfDay(todayISO());
  const closedR = trades
    .filter(function (t) {
      return t.result !== 'open';
    })
    .reduce(function (sum, t) {
      return sum + (Number(t.actualR) || 0);
    }, 0);

  const reached =
    limits.enabled &&
    (trades.length >= maxTrades || closedR <= -maxLoss + 0.0001);

  return {
    enabled: limits.enabled,
    count: trades.length,
    maxTrades: maxTrades,
    r: closedR,
    maxLoss: maxLoss,
    reached: reached
  };
}

function todayCycle() {
  return (
    db.cycles.find(function (cycle) {
      return cycle.day === todayISO();
    }) || null
  );
}

function cycleById(id) {
  return (
    db.cycles.find(function (cycle) {
      return cycle.id === id;
    }) || null
  );
}

function tradeById(id) {
  return (
    db.trades.find(function (trade) {
      return trade.id === id;
    }) || null
  );
}

function cycleLabel(cycle) {
  if (!cycle) return 'Новый торговый день';
  if (cycle.stopDay) return 'STOP DAY';
  if (cycle.result === 'entry') {
    const trade = tradeById(cycle.tradeId);
    if (trade && trade.result !== 'open') return 'Сделка закрыта';
    return 'Сделка открыта';
  }
  return 'Черновик сохранён';
}


/* =========================================================
   7. Иконки и общие элементы
   ========================================================= */

const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
  trades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
  ladder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h4v-4h5v-5h5V6h4"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 11h18"/></svg>',
  goal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
  levels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M18.4 5.6l-2.1 2.1"/><path d="M7.7 16.3l-2.1 2.1"/></svg>'
};

const NAV = [
  { key: 'today', label: 'Сегодня', icon: 'today' },
  { key: 'trades', label: 'Сделки', icon: 'trades' },
  { key: 'ladder', label: 'Risk Ladder', icon: 'ladder' },
  { key: 'stats', label: 'Статистика', icon: 'stats' },
  { key: 'calendar', label: 'Календарь', icon: 'calendar' },
  { key: 'week', label: 'Разбор недели', icon: 'stats' },
  { key: 'achievements', label: 'Достижения', icon: 'goal' },
  { key: 'goal', label: 'Цель', icon: 'goal' },
  { key: 'levels', label: 'Уровни', icon: 'levels' },
  { key: 'settings', label: 'Настройки', icon: 'settings' }
];

function setPath(target, path, value) {
  const parts = path.split('.');
  let ref = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (ref[key] == null || typeof ref[key] !== 'object') ref[key] = {};
    ref = ref[key];
  }
  ref[parts[parts.length - 1]] = value;
}

function getPath(target, path) {
  return path.split('.').reduce(function (acc, key) {
    return acc == null ? null : acc[key];
  }, target);
}

function checkHTML(on, label, act, extra) {
  return (
    '<button class="check ' + (on ? 'on' : '') + '" data-act="' + act + '" ' + (extra || '') + '>' +
    '<span class="box">✓</span><span>' + esc(label) + '</span></button>'
  );
}

function chipHTML(label, active, act, extra) {
  return (
    '<button class="chip ' + (active ? 'active ' : '') + (extra || '') + '" data-act="' + act + '">' +
    esc(label) + '</button>'
  );
}

function fieldHTML(label, inner) {
  return '<label class="field"><span>' + esc(label) + '</span>' + inner + '</label>';
}

function inputHTML(path, value, opts) {
  const options = opts || {};
  const type = options.type || 'text';
  const cls = 'input' + (options.mono ? ' mono' : '');
  return (
    '<input class="' + cls + '" type="' + type + '" step="' + (options.step || 'any') + '"' +
    ' value="' + esc(value == null ? '' : value) + '"' +
    ' data-bind="' + path + '" data-kind="' + (options.kind || 'auto') + '"' +
    ' placeholder="' + esc(options.placeholder || '') + '">'
  );
}

function rowBar(wins, losses, total) {
  const safeTotal = Math.max(1, total);
  const winWidth = (wins / safeTotal) * 100;
  const lossWidth = (losses / safeTotal) * 100;
  return (
    '<div class="bar"><i class="win" style="width:' + winWidth + '%"></i>' +
    '<i class="loss" style="width:' + lossWidth + '%"></i></div>'
  );
}

/* =========================================================
   8. Оболочка
   ========================================================= */

const VIEW_META = {
  today: { eyebrow: 'Рабочий стол', title: 'Сегодня', sub: 'Цикл 19:00 → 22:00, строго по шагам' },
  trades: { eyebrow: 'Журнал', title: 'Сделки', sub: 'Открытые и закрытые позиции' },
  ladder: { eyebrow: 'Риск', title: 'Risk Ladder', sub: 'Ступени риска и накопленные R' },
  stats: { eyebrow: 'Результат', title: 'Статистика', sub: 'Период, разбивки и графики' },
  calendar: { eyebrow: 'Дни', title: 'Календарь', sub: 'Результат каждого торгового дня' },
  goal: { eyebrow: 'Цель', title: 'Цель месяца', sub: 'Прогресс по R и прошлые месяцы' },
  levels: { eyebrow: 'Уровни', title: 'Ключевые уровни', sub: 'Библиотека уровней из всех циклов' },
  settings: { eyebrow: 'Система', title: 'Настройки', sub: 'Символы, лестница, лимиты и данные' }
};

function sidebarHTML() {
  const step = db.ladder.step;
  const nav = NAV.map(function (item) {
    return (
      '<button class="nav-item ' + (ui.view === item.key ? 'active' : '') + '" data-act="nav" data-view="' + item.key + '">' +
      ICONS[item.icon] +
      '<span class="label-text">' + item.label + '</span>' +
      (item.key === 'trades' && openTradesCount() ? '<span class="badge">' + openTradesCount() + '</span>' : '') +
      '</button>'
    );
  }).join('');

  return (
    '<aside class="sidebar">' +
    '<div class="brand">' +
    '<div class="brand-mark">ICT</div>' +
    '<div class="brand-titles"><div class="brand-title">ICT Checklist</div>' +
    '<div class="brand-sub">trading desk</div></div>' +
    '</div>' +
    '<nav class="nav"><div class="nav-label">Рабочий стол</div>' + nav + '</nav>' +
    '<div class="sidebar-spacer"></div>' +
    '<div class="ladder-mini">' +
    '<div class="ladder-mini-title">Следующая сделка</div>' +
    '<div class="ladder-mini-value">' + fmtMoney(ladderAmount(step)) + '</div>' +
    '<div class="ladder-mini-sub">Ступень ' + (step + 1) + ' из 3 · ' + fmtR(db.ladder.accR) + '</div>' +
    '</div>' +
    '<div class="sidebar-foot"><span>Локальные данные</span><span>v1.0</span></div>' +
    '</aside>'
  );
}

function openTradesCount() {
  return db.trades.filter(function (trade) {
    return trade.result === 'open';
  }).length;
}

function topbarHTML() {
  const meta = VIEW_META[ui.view] || VIEW_META.today;
  let actions = '';

  if (ui.view === 'today') {
    actions =
      '<button class="btn" data-act="nav" data-view="levels">Уровни</button>' +
      '<button class="btn" data-act="nav" data-view="settings">Настройки</button>';
  } else if (ui.view === 'trades') {
    actions = '<button class="btn btn-primary" data-act="new-trade">+ Новая сделка</button>';
  } else if (ui.view === 'stats') {
    actions =
      '<button class="btn" data-act="nav" data-view="goal">Цель</button>' +
      '<button class="btn" data-act="nav" data-view="calendar">Календарь</button>';
  } else if (ui.view === 'calendar') {
    actions = '<button class="btn" data-act="nav" data-view="stats">Статистика</button>';
  } else if (ui.view === 'goal') {
    actions = '<button class="btn" data-act="nav" data-view="stats">К статистике</button>';
  } else if (ui.view === 'levels') {
    actions = '<button class="btn" data-act="nav" data-view="today">К циклу</button>';
  } else if (ui.view === 'settings') {
    actions = '<button class="btn" data-act="export">Скачать копию</button>';
  }

  const sub = ui.view === 'today' ? todaySubtitle() : meta.sub;

  return (
    '<header class="topbar">' +
    '<div class="topbar-titles">' +
    '<div class="eyebrow">' + meta.eyebrow + '</div>' +
    '<h1 class="page-title">' + meta.title + '</h1>' +
    '<div class="page-sub">' + esc(sub) + '</div>' +
    '</div>' +
    '<div class="topbar-actions">' + actions + '</div>' +
    '</header>'
  );
}

function todaySubtitle() {
  const cycle = todayCycle();
  if (cycle) {
    return fmtDay(cycle.day) + ' · ' + cycleLabel(cycle);
  }
  return fmtDay(todayISO()) + ' · новый цикл';
}

function mondayISO(iso) {
  const date = dateFromISO(iso);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return isoDate(date);
}

function addDaysISO(iso, days) {
  const date = dateFromISO(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function longDate(iso) {
  return dateFromISO(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function weekRange(iso) {
  return longDate(iso) + '–' + longDate(addDaysISO(iso, 6));
}

function monthTitle(key) {
  return new Date(key + '-01T00:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function runWord(count) {
  const n = Math.abs(count) % 100;
  const k = Math.abs(count) % 10;
  if (n >= 11 && n <= 14) return 'недель подряд';
  if (k === 1) return 'неделя подряд';
  if (k >= 2 && k <= 4) return 'недели подряд';
  return 'недель подряд';
}

function dayRunWord(count) {
  const n = Math.abs(count) % 100;
  const k = Math.abs(count) % 10;
  if (n >= 11 && n <= 14) return 'дней';
  if (k === 1) return 'день';
  if (k >= 2 && k <= 4) return 'дня';
  return 'дней';
}

function weekTrades() {
  return closedTrades().filter(function (trade) {
    return inPeriod(trade.tradeDay, 'week');
  });
}

function weekView() {
  const trades = weekTrades();
  const stats = groupStats(trades);

  const byDay = {};
  trades.forEach(function (trade) {
    byDay[trade.tradeDay] = (byDay[trade.tradeDay] || 0) + (Number(trade.actualR) || 0);
  });
  const bestDay = Object.keys(byDay).sort(function (a, b) {
    return byDay[b] - byDay[a];
  })[0];

  return (
    '<div class="stack">' +
    '<div class="row" style="justify-content:space-between">' +
    '<div><div class="label">Weekly performance</div><div class="card-title" style="font-size:22px">Разбор недели</div></div>' +
    '<span class="muted">последние 7 дней</span>' +
    '</div>' +
    (trades.length
      ? '<div class="grid grid-4">' +
        '<div class="card tight"><div class="label">Итог R</div><div class="kpi sm ' + rClass(stats.totalR) + '">' + fmtR(stats.totalR) + '</div>' +
        '<div class="list-sub">' + dealsWord(stats.count) + '</div></div>' +
        '<div class="card tight"><div class="label">Win rate</div><div class="kpi sm">' + fmtPercent(stats.winRate) + '</div>' +
        '<div class="list-sub">' + stats.wins + ' из ' + stats.count + '</div></div>' +
        '<div class="card tight"><div class="label">Лучший день</div><div class="kpi sm ' + rClass(bestDay ? byDay[bestDay] : 0) + '">' +
        (bestDay ? fmtR(byDay[bestDay]) : '—') + '</div>' +
        '<div class="list-sub">' + (bestDay ? longDate(bestDay) : 'нет сделок') + '</div></div>' +
        '<div class="card tight"><div class="label">Средний R</div><div class="kpi sm">' + fmtSigned(stats.averageR, 2) + '</div>' +
        '<div class="list-sub">на сделку</div></div>' +
        '</div>' +
        '<div class="card tight"><div class="card-title">Сделки недели</div><div class="list">' +
        trades
          .slice()
          .sort(function (a, b) {
            return closeTime(a) - closeTime(b);
          })
          .map(function (trade) {
            return (
              '<div class="list-row"><div class="grow"><div class="list-title">' + esc(trade.symbol) + ' · ' + esc(trade.direction) + '</div>' +
              '<div class="list-sub">' + esc(longDate(trade.tradeDay)) + ' · ' + esc(trade.result.toUpperCase()) + '</div></div>' +
              '<span class="mono ' + rClass(trade.actualR) + '">' + fmtR(trade.actualR) + '</span></div>'
            );
          })
          .join('') +
        '</div></div>'
      : '<div class="card"><div class="empty" style="border:0">За последние 7 дней нет закрытых сделок. Закройте позицию — здесь появится разбор.</div></div>') +
    '<div class="card tight"><div class="list-sub">Разбор считается по закрытым сделкам и ничего не меняет. Полный разбор с блоками статистики — на «Статистике».</div></div>' +
    '</div>'
  );
}

function achievementsView() {
  const trades = closedTrades();

  const dayR = {};
  const daySL = {};
  trades.forEach(function (trade) {
    const day = trade.tradeDay;
    dayR[day] = (dayR[day] || 0) + (Number(trade.actualR) || 0);
    if (trade.result === 'sl') daySL[day] = true;
  });
  const days = Object.keys(dayR).sort();

  let dayRun = 0;
  let bestDayRun = 0;
  days.forEach(function (day) {
    if (dayR[day] > 0.05) {
      dayRun += 1;
      bestDayRun = Math.max(bestDayRun, dayRun);
    } else {
      dayRun = 0;
    }
  });
  let currentDayRun = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (dayR[days[i]] > 0.05) currentDayRun += 1;
    else break;
  }

  const weekR = {};
  const weekWins = {};
  const weekCounts = {};
  trades.forEach(function (trade) {
    const week = mondayISO(trade.tradeDay);
    weekR[week] = (weekR[week] || 0) + (Number(trade.actualR) || 0);
    weekCounts[week] = (weekCounts[week] || 0) + 1;
    if ((Number(trade.actualR) || 0) > 0.05) weekWins[week] = (weekWins[week] || 0) + 1;
  });
  const weeks = Object.keys(weekR).sort();

  let weekRun = 0;
  let bestWeekRun = 0;
  let previous = null;
  weeks.forEach(function (week) {
    if (weekR[week] > 0.05) {
      weekRun = previous && addDaysISO(previous, 7) === week ? weekRun + 1 : 1;
      bestWeekRun = Math.max(bestWeekRun, weekRun);
    } else {
      weekRun = 0;
    }
    previous = week;
  });
  let currentWeekRun = 0;
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (weekR[weeks[i]] > 0.05) currentWeekRun += 1;
    else break;
  }

  const monthR = {};
  trades.forEach(function (trade) {
    const month = trade.tradeDay.slice(0, 7);
    monthR[month] = (monthR[month] || 0) + (Number(trade.actualR) || 0);
  });

  const bestDayKey = days.slice().sort(function (a, b) {
    return dayR[b] - dayR[a];
  })[0];
  const bestWeekKey = weeks.slice().sort(function (a, b) {
    return weekR[b] - weekR[a];
  })[0];
  const bestMonthKey = Object.keys(monthR).sort(function (a, b) {
    return monthR[b] - monthR[a];
  })[0];
  const bestWeekRateKey = weeks.slice().sort(function (a, b) {
    return weekWins[b] / weekCounts[b] - weekWins[a] / weekCounts[a];
  })[0];

  const noSL = days.filter(function (day) {
    return !daySL[day];
  }).length;
  const noSLRate = days.length ? noSL / days.length : 0;

  const tiles = [
    { title: 'Серия недель', value: currentWeekRun + ' ' + runWord(currentWeekRun), caption: bestWeekRun ? 'лучшая ' + bestWeekRun : 'Пока не достигнуто', ok: bestWeekRun > 0 },
    { title: 'Серия дней', value: currentDayRun + ' ' + dayRunWord(currentDayRun) + ' с прибылью', caption: bestDayRun ? 'рекорд ' + bestDayRun : 'Пока не достигнуто', ok: bestDayRun > 0 },
    { title: 'Лучший день', value: bestDayKey ? fmtR(dayR[bestDayKey]) : '—', caption: bestDayKey ? longDate(bestDayKey) : 'Пока не достигнуто', ok: !!bestDayKey },
    { title: 'Лучшая неделя', value: bestWeekKey ? fmtR(weekR[bestWeekKey]) : '—', caption: bestWeekKey ? weekRange(bestWeekKey) : 'Пока не достигнуто', ok: !!bestWeekKey },
    { title: 'Лучший месяц', value: bestMonthKey ? fmtR(monthR[bestMonthKey]) : '—', caption: bestMonthKey ? monthTitle(bestMonthKey) : 'Пока не достигнуто', ok: !!bestMonthKey },
    { title: 'Без SL', value: Math.round(noSLRate * 100) + '% дней', caption: days.length ? 'дни без стоп-лосса' : 'Пока не достигнуто', ok: days.length > 0 },
    { title: 'Win rate недели', value: bestWeekRateKey ? fmtPercent(weekWins[bestWeekRateKey] / weekCounts[bestWeekRateKey]) : '—', caption: bestWeekRateKey ? 'неделя ' + weekRange(bestWeekRateKey) : 'Пока не достигнуто', ok: !!bestWeekRateKey }
  ];

  const achieved = tiles.filter(function (tile) {
    return tile.ok;
  }).length;

  return (
    '<div class="stack">' +
    '<div class="card">' +
    '<div class="label">Собрано</div>' +
    '<div class="kpi">' + achieved + ' из ' + tiles.length + '</div>' +
    '<div class="list-sub">Рекорды собираются из закрытых сделок</div>' +
    '</div>' +
    '<div class="grid grid-2">' +
    tiles
      .map(function (tile) {
        return (
          '<div class="card tight">' +
          '<div class="label">' + esc(tile.title) + '</div>' +
          '<div class="kpi sm ' + (tile.ok ? '' : 'muted') + '">' + esc(tile.value) + '</div>' +
          '<div class="list-sub">' + esc(tile.caption) + '</div>' +
          '</div>'
        );
      })
      .join('') +
    '</div>' +
    '<div class="card tight"><div class="list-sub">Достижения считаются по закрытым сделкам и ничего не меняют</div></div>' +
    '</div>'
  );
}

function render() {
  const app = document.getElementById('app');
  let body = '';

  if (ui.view === 'today') body = todayView();
  else if (ui.view === 'trades') body = tradesView();
  else if (ui.view === 'ladder') body = ladderView();
  else if (ui.view === 'stats') body = statsView();
  else if (ui.view === 'calendar') body = calendarView();
  else if (ui.view === 'week') body = weekView();
  else if (ui.view === 'achievements') body = achievementsView();
  else if (ui.view === 'goal') body = goalView();
  else if (ui.view === 'levels') body = levelsView();
  else body = settingsView();

  app.innerHTML = sidebarHTML() + '<main class="main">' + topbarHTML() + body + '</main>';
  window.scrollTo({ top: 0 });
}

/* =========================================================
   9. Экран «Сегодня»
   ========================================================= */

function currentCycle() {
  return todayCycle();
}

function draftCycle() {
  const cycle = currentCycle();
  return cycle && cycle.result === 'draft' ? cycle : null;
}

function stepKey(cycle) {
  return STEPS[cycle.step].key;
}

function directionMeta(direction) {
  return direction === 'LONG'
    ? { color: '#43d8a0', label: 'LONG' }
    : { color: '#ff6b6b', label: 'SHORT' };
}

function drMid(cycle) {
  const high = num(cycle.drHigh);
  const low = num(cycle.drLow);
  if (high == null || low == null || high <= low) return null;
  return (high + low) / 2;
}

function zoneOf(cycle) {
  const mid = drMid(cycle);
  const price = num(cycle.price);
  if (mid == null || price == null) return null;
  return price >= mid ? 'PREMIUM' : 'DISCOUNT';
}

function expectedZone(direction) {
  return direction === 'LONG' ? 'DISCOUNT' : 'PREMIUM';
}

function computedRR(cycle) {
  const entry = num(cycle.entry.entry);
  const sl = num(cycle.entry.sl);
  const tp = num(cycle.entry.tp);
  if (entry == null || sl == null || tp == null || entry <= 0) return null;
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

function scenarioEnded(cycle) {
  return cycle.a.valid === false || cycle.b.valid === false;
}

function blockingHint(cycle) {
  const key = stepKey(cycle);

  if (key === 'lastDR') {
    if (num(cycle.drHigh) == null || num(cycle.drLow) == null) return 'Заполните верхнюю и нижнюю границы DR';
    if (num(cycle.drHigh) <= num(cycle.drLow)) return 'Верхняя граница должна быть выше нижней';
    return null;
  }
  if (key === 'keyLevels') {
    return activeLevels(cycle).length ? null : 'Добавьте хотя бы один актуальный Key Level';
  }
  if (key === 'keyLevelToPointA') {
    return cycle.a.snr && cycle.a.of && cycle.a.fractal ? null : 'Point A не сформирован — нужны все три условия';
  }
  if (key === 'pointA') {
    if (!(num(cycle.a.price) > 0)) return 'Укажите цену Point A';
    return cycle.a.valid === false ? 'A не валиден — сформируйте новый Point A' : null;
  }
  if (key === 'pointB') {
    if (!(num(cycle.b.price) > 0)) return 'Укажите цену Point B';
    return cycle.b.valid === false ? 'B не валиден — сценарий завершён, нужен новый Point A' : null;
  }
  if (CONFIRM_STEPS.indexOf(key) >= 0) {
    if (scenarioEnded(cycle)) return 'Сценарий завершён — вернитесь к Point A';
    return cycle.confirmations[key] ? null : 'Отметьте пункт, чтобы продолжить';
  }
  if (key === 'rr') {
    if (scenarioEnded(cycle)) return 'Сценарий завершён — вход невозможен';
    if (num(cycle.entry.entry) == null || num(cycle.entry.sl) == null || num(cycle.entry.tp) == null) {
      return 'Заполните entry, SL и TP';
    }
    const rr = computedRR(cycle);
    if (rr == null) return 'RR не посчитан — проверьте цены';
    return rr >= Number(db.settings.minRR) ? null : 'RR ' + rr.toFixed(2) + ' ниже минимума ' + Number(db.settings.minRR).toFixed(2) + ' — входа нет';
  }
  if (key === 'entry') {
    if (cycle.stopDay) return 'STOP DAY — новых входов сегодня нет';
    if (limitsState().reached) return 'Лимит дня · новых входов нет до следующего цикла';
    const rr = computedRR(cycle);
    if (rr == null) return 'Заполните entry, SL и TP на шаге RR';
    if (rr < Number(db.settings.minRR)) return 'RR ниже минимума — входа нет';
    if (scenarioEnded(cycle)) return 'Сценарий завершён — вход невозможен';
    return null;
  }
  return null;
}

function canAdvance(cycle) {
  return blockingHint(cycle) == null;
}

function activeLevels(cycle) {
  return (cycle.levels || []).filter(function (level) {
    return !level.absorbed;
  });
}

function todayView() {
  const cycle = currentCycle();
  const left = cycle ? cycleDraftOrResult(cycle) : startCardHTML();
  const right = todaySideHTML(cycle);
  const banner = todayBannerHTML(cycle);

  return banner + '<div class="layout-main"><div class="stack">' + left + '</div>' + right + '</div>';
}

function todayBannerHTML(cycle) {
  if (cycle && cycle.stopDay) {
    return (
      '<div class="banner red" style="margin-bottom:18px"><div>' +
      '<b>Stop day</b>SL в этом дне — новых входов нет. Следующий цикл в ' + esc(db.settings.cycleStart) + '.' +
      '</div></div>'
    );
  }
  const limits = limitsState();
  if (limits.reached) {
    return (
      '<div class="banner orange" style="margin-bottom:18px"><div>' +
      '<b>Лимит дня</b>Лимит дня · новых входов нет. Следующий цикл в ' + esc(db.settings.cycleStart) + '.' +
      '</div></div>'
    );
  }
  return '';
}

function startCardHTML() {
  return (
    '<div class="card"><div class="card-head"><h3>Новый торговый день</h3></div>' +
    '<p class="muted" style="margin:0 0 18px;line-height:1.5">' +
    esc(db.settings.cycleStart) + ' — запуск цикла, ' + esc(db.settings.cycleEnd) +
    ' — закрытие терминала. Между ними рынок анализируется и принимается решение.</p>' +
    '<button class="btn btn-primary" data-act="start-cycle">Начать цикл →</button>' +
    '<p class="muted" style="margin:16px 0 0;font-size:12.5px">Только зашли? В «Настройках» есть кнопка «Демо-данные» — она заполнит два месяца сделок, чтобы увидеть статистику и календарь.</p>' +
    '</div>'
  );
}

function cycleDraftOrResult(cycle) {
  if (cycle.result === 'draft') return draftFlowHTML(cycle);
  return dayResultHTML(cycle);
}

function draftFlowHTML(cycle) {
  const step = STEPS[cycle.step];
  const progress = Math.round(((cycle.step + 1) / STEPS.length) * 100);
  const canNext = canAdvance(cycle);
  const hint = blockingHint(cycle);
  const isEntry = step.key === 'entry';

  const rail = STEPS.map(function (item, index) {
    const cls = index < cycle.step ? 'done' : index === cycle.step ? 'current' : '';
    return '<span class="' + cls + '">' + item.title + '</span>';
  }).join('');

  return (
    '<div class="card tight">' +
    '<div class="row between" style="margin-bottom:10px">' +
    '<span class="label" style="letter-spacing:1px">ШАГ ' + step.num + ' ИЗ ' + STEPS.length + '</span>' +
    '<span class="pill accent">Ступень ' + (cycle.risk.step + 1) + ' · ' + fmtMoney(cycle.risk.usd) + ' · ' + fmtR(cycle.risk.accR) + '</span>' +
    '</div>' +
    '<div class="progress"><i style="width:' + progress + '%"></i></div>' +
    '<div class="step-rail" style="margin-top:12px">' + rail + '</div>' +
    '</div>' +
    '<div class="card">' +
    '<div class="card-head"><h3>' + step.title + '</h3><span class="spacer"></span>' +
    '<span class="pill">' + step.group + '</span></div>' +
    stepBodyHTML(cycle) +
    (hint ? '<div class="banner orange" style="margin-top:16px"><div>' + esc(hint) + '</div></div>' : '') +
    '<div class="row" style="margin-top:18px">' +
    '<button class="btn" data-act="step-prev" ' + (cycle.step === 0 ? 'disabled' : '') + '>← Назад</button>' +
    '<span class="spacer"></span>' +
    '<button class="btn btn-primary" data-act="step-next" ' + (canNext ? '' : 'disabled') + '>' +
    (isEntry ? 'Открыть сделку ✓' : 'Далее →') +
    '</button>' +
    '</div>' +
    '</div>' +
    completedStepsHTML(cycle)
  );
}

function completedStepsHTML(cycle) {
  const done = STEPS.slice(0, cycle.step);
  if (!done.length) return '';
  const rows = done
    .slice(-4)
    .reverse()
    .map(function (item) {
      const index = STEPS.findIndex(function (s) {
        return s.key === item.key;
      });
      return (
        '<div class="list-row">' +
        '<span class="pill green">✓</span>' +
        '<div class="grow"><div class="list-title">' + item.title + '</div>' +
        '<div class="list-sub">' + esc(stepSummary(cycle, index)) + '</div></div>' +
        '<button class="btn btn-sm btn-ghost" data-act="step-jump" data-index="' + index + '">Открыть</button>' +
        '</div>'
      );
    })
    .join('');

  return '<div class="card tight"><div class="card-title">Пройдено</div><div class="list">' + rows + '</div></div>';
}

function stepSummary(cycle, index) {
  const key = STEPS[index].key;
  if (key === 'news') {
    const flags = ['EUR', 'GBP', 'USD'].filter(function (code) {
      return cycle.news[code.toLowerCase()];
    });
    return flags.length ? 'Важно: ' + flags.join(', ') : 'Новостей нет';
  }
  if (key === 'risk') return 'Ступень ' + (cycle.risk.step + 1) + ' · ' + fmtMoney(cycle.risk.usd);
  if (key === 'ofsof') return cycle.direction + ' · ' + cycle.trend;
  if (key === 'trendW1') return cycle.direction + (cycle.trendNote ? ' · ' + cycle.trendNote : '');
  if (key === 'lastDR') return fmtPrice(cycle.drLow) + ' – ' + fmtPrice(cycle.drHigh);
  if (key === 'premiumDiscount') {
    const zone = zoneOf(cycle);
    return zone ? zone : 'Зона не определена';
  }
  if (key === 'keyLevels') return activeLevels(cycle).length + ' активных';
  if (key === 'keyLevelToPointA') return cycle.a.snr && cycle.a.of && cycle.a.fractal ? 'A сформирован' : 'A пока нет';
  if (key === 'pointA') return fmtPrice(cycle.a.price) + (cycle.a.valid ? ' · валиден' : ' · не валиден');
  if (key === 'pointB') return (cycle.b.type || 'Fractal') + ' · ' + fmtPrice(cycle.b.price);
  if (CONFIRM_STEPS.indexOf(key) >= 0) return cycle.confirmations[key] ? 'Подтверждено' : 'Не отмечено';
  if (key === 'rr') return 'RR ' + (computedRR(cycle) == null ? '—' : computedRR(cycle).toFixed(2));
  if (key === 'symbol') return cycle.symbol;
  return 'Вход открыт';
}

function stepBodyHTML(cycle) {
  const key = stepKey(cycle);

  if (key === 'news') {
    return (
      '<div class="grid grid-3">' +
      checkHTML(cycle.news.eur, 'EUR — важные новости', 'toggle-news', 'data-code="eur"') +
      checkHTML(cycle.news.gbp, 'GBP — важные новости', 'toggle-news', 'data-code="gbp"') +
      checkHTML(cycle.news.usd, 'USD — важные новости', 'toggle-news', 'data-code="usd"') +
      '</div>' +
      '<div class="field" style="margin-top:14px"><span>Заметка</span>' +
      '<textarea class="textarea" data-bind="news.note" data-kind="text" placeholder="Что учесть из новостей">' +
      esc(cycle.news.note) + '</textarea></div>'
    );
  }

  if (key === 'risk') {
    return (
      '<div class="grid grid-3">' +
      '<div class="card tight"><div class="label">Ступень</div><div class="kpi sm">' + (cycle.risk.step + 1) + ' / 3</div></div>' +
      '<div class="card tight"><div class="label">Риск на сделку</div><div class="kpi sm">' + fmtMoney(cycle.risk.usd) + '</div></div>' +
      '<div class="card tight"><div class="label">Накоплено в ступени</div><div class="kpi sm">' + fmtR(cycle.risk.accR) + '</div></div>' +
      '</div>' +
      '<p class="muted" style="margin:14px 0 0">Лестница подтягивается автоматически: +2R внутри ступени — переход выше, SL — сброс на $' +
      Number(db.settings.ladder[0]) + '.</p>'
    );
  }

  if (key === 'ofsof') {
    return (
      '<div class="row" style="gap:8px;margin-bottom:14px">' +
      chipHTML('LONG', cycle.direction === 'LONG', 'set-direction', 'data-value="LONG"') +
      chipHTML('SHORT', cycle.direction === 'SHORT', 'set-direction', 'data-value="SHORT"') +
      '</div>' +
      '<div class="row" style="gap:8px;margin-bottom:16px">' +
      chipHTML('OF — доставка', cycle.trend === 'OF', 'set-trend', 'data-value="OF"') +
      chipHTML('SOF — нет доставки', cycle.trend === 'SOF', 'set-trend', 'data-value="SOF"') +
      '</div>' +
      '<div class="field"><span>Заметка</span><textarea class="textarea" data-bind="trendNote" data-kind="text" ' +
      'placeholder="Почему такой поток">' + esc(cycle.trendNote) + '</textarea></div>'
    );
  }

  if (key === 'trendW1') {
    return (
      '<div class="row" style="gap:8px;margin-bottom:16px">' +
      chipHTML('LONG', cycle.direction === 'LONG', 'set-direction', 'data-value="LONG"') +
      chipHTML('SHORT', cycle.direction === 'SHORT', 'set-direction', 'data-value="SHORT"') +
      '</div>' +
      '<div class="field"><span>Заметка по W1</span><textarea class="textarea" data-bind="trendNote" data-kind="text" ' +
      'placeholder="Тренд W1 и что из него следует">' + esc(cycle.trendNote) + '</textarea></div>'
    );
  }

  if (key === 'lastDR') {
    return (
      '<div class="form-grid">' +
      fieldHTML('Верхняя граница DR', inputHTML('drHigh', cycle.drHigh, { type: 'number', mono: true, placeholder: '1.0850' })) +
      fieldHTML('Нижняя граница DR', inputHTML('drLow', cycle.drLow, { type: 'number', mono: true, placeholder: '1.0800' })) +
      '</div>' +
      '<div class="form-grid" style="margin-top:14px">' +
      fieldHTML('Текущая цена', inputHTML('price', cycle.price, { type: 'number', mono: true, placeholder: '1.0820' })) +
      '<div class="field"><span>0.5 DR</span><div class="input mono">' + (drMid(cycle) == null ? '—' : fmtPrice(drMid(cycle))) + '</div></div>' +
      '</div>'
    );
  }

  if (key === 'premiumDiscount') {
    const zone = zoneOf(cycle);
    const mid = drMid(cycle);
    const mismatch = zone && zone !== expectedZone(cycle.direction);
    return (
      '<div class="grid grid-3">' +
      '<div class="card tight"><div class="label">0.5 DR</div><div class="kpi sm">' + (mid == null ? '—' : fmtPrice(mid)) + '</div></div>' +
      '<div class="card tight"><div class="label">Зона по цене</div><div class="kpi sm">' + (zone || '—') + '</div></div>' +
      '<div class="card tight"><div class="label">Нужна для ' + cycle.direction + '</div><div class="kpi sm">' + expectedZone(cycle.direction) + '</div></div>' +
      '</div>' +
      '<div style="margin-top:14px">' +
      fieldHTML('Текущая цена', inputHTML('price', cycle.price, { type: 'number', mono: true, placeholder: '1.0820' })) +
      '</div>' +
      (mismatch
        ? '<div class="banner orange" style="margin-top:14px"><div>Зона не совпадает с направлением — вход против зоны.</div></div>'
        : '<p class="muted" style="margin:14px 0 0">Цена в нужной зоне для ' + cycle.direction + '.</p>')
    );
  }

  if (key === 'keyLevels') {
    const rows = (cycle.levels || [])
      .map(function (level) {
        const color = levelColor(level.type);
        return (
          '<div class="list-row">' +
          '<span class="level-dot" style="background:' + color + '"></span>' +
          '<div class="grow"><div class="list-title">' + esc(level.type) + ' · ' + fmtPrice(level.price) + '</div>' +
          '<div class="list-sub">' + (level.note ? esc(level.note) : 'без заметки') + '</div></div>' +
          '<button class="btn btn-sm" data-act="toggle-level" data-id="' + level.id + '">' +
          (level.absorbed ? 'Вернуть' : 'Поглощён') + '</button>' +
          '<button class="btn btn-sm btn-danger" data-act="remove-level" data-id="' + level.id + '">×</button>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="list">' + (rows || '<div class="empty">Уровней пока нет — добавьте первый ниже.</div>') + '</div>' +
      '<div class="divider"></div>' +
      '<div class="form-grid" style="grid-template-columns: 130px 1fr 1fr auto;align-items:end">' +
      '<label class="field"><span>Тип</span><select class="select" data-bind="__levelType" data-kind="level-type">' +
      LEVEL_TYPES.map(function (t) {
        return '<option value="' + t.key + '"' + (levelDraft.type === t.key ? ' selected' : '') + '>' + t.key + '</option>';
      }).join('') +
      '</select></label>' +
      '<label class="field"><span>Цена</span><input class="input mono" type="number" step="any" data-bind="__levelPrice" data-kind="level-price" value="' +
      esc(levelDraft.price) + '" placeholder="1.0820"></label>' +
      '<label class="field"><span>Заметка</span><input class="input" type="text" data-bind="__levelNote" data-kind="level-note" value="' +
      esc(levelDraft.note) + '" placeholder="Комментарий"></label>' +
      '<button class="btn" data-act="add-level">Добавить</button>' +
      '</div>'
    );
  }

  if (key === 'keyLevelToPointA') {
    return (
      '<div class="grid grid-3">' +
      checkHTML(cycle.a.snr, 'SNR', 'toggle-a', 'data-field="snr"') +
      checkHTML(cycle.a.of, 'OF', 'toggle-a', 'data-field="of"') +
      checkHTML(cycle.a.fractal, 'Fractal', 'toggle-a', 'data-field="fractal"') +
      '</div>' +
      '<p class="muted" style="margin:14px 0 0">Point A формируется, когда совпали все три условия.</p>'
    );
  }

  if (key === 'pointA') {
    return (
      '<div class="form-grid">' +
      fieldHTML('Цена Point A', inputHTML('a.price', cycle.a.price, { type: 'number', mono: true, placeholder: '1.0810' })) +
      fieldHTML('Глубина захода', inputHTML('a.depth', cycle.a.depth, { type: 'number', mono: true, placeholder: '0.3' })) +
      '</div>' +
      '<div class="field" style="margin-top:14px"><span>Заметка</span>' +
      '<textarea class="textarea" data-bind="a.note" data-kind="text" placeholder="Что за уровень и почему A">' +
      esc(cycle.a.note) + '</textarea></div>' +
      '<div style="margin-top:14px">' +
      checkHTML(cycle.a.valid, 'Point A валиден', 'toggle-a-valid') +
      '</div>'
    );
  }

  if (key === 'pointB') {
    return (
      '<div class="form-grid">' +
      fieldHTML('Цена Point B', inputHTML('b.price', cycle.b.price, { type: 'number', mono: true, placeholder: '1.0850' })) +
      '<label class="field"><span>Тип B</span><select class="select" data-bind="b.type" data-kind="text">' +
      POINT_B_TYPES.map(function (type) {
        return '<option value="' + type + '"' + (cycle.b.type === type ? ' selected' : '') + '>' + type + '</option>';
      }).join('') +
      '</select></label>' +
      '</div>' +
      '<div class="field" style="margin-top:14px"><span>Заметка</span>' +
      '<textarea class="textarea" data-bind="b.note" data-kind="text" placeholder="Почему этот B">' +
      esc(cycle.b.note) + '</textarea></div>' +
      '<div style="margin-top:14px">' +
      checkHTML(cycle.b.valid !== false, 'Point B валиден', 'toggle-b-valid') +
      '</div>'
    );
  }

  if (CONFIRM_STEPS.indexOf(key) >= 0) {
    return (
      checkHTML(
        Boolean(cycle.confirmations[key]),
        'Подтверждено: ' + STEPS[cycle.step].title,
        'toggle-confirmation',
        'data-key="' + key + '"'
      )
    );
  }

  if (key === 'rr') {
    const rr = computedRR(cycle);
    const minRR = Number(db.settings.minRR);
    const ok = rr != null && rr >= minRR;
    return (
      '<div class="form-grid">' +
      fieldHTML('Entry', inputHTML('entry.entry', cycle.entry.entry, { type: 'number', mono: true, placeholder: 'Цена входа' })) +
      fieldHTML('SL — за Point A', inputHTML('entry.sl', cycle.entry.sl, { type: 'number', mono: true, placeholder: 'Стоп за A' })) +
      '</div>' +
      '<div class="form-grid" style="margin-top:14px">' +
      fieldHTML('TP — Point B', inputHTML('entry.tp', cycle.entry.tp, { type: 'number', mono: true, placeholder: 'Цель на B' })) +
      '<div class="field"><span>RR</span><div class="input mono ' + (ok ? 'positive' : 'negative') + '">' +
      (rr == null ? '—' : rr.toFixed(2)) + ' / мин. ' + minRR.toFixed(2) + '</div></div>' +
      '</div>'
    );
  }

  if (key === 'symbol') {
    const symbols = db.settings.symbols;
    return (
      '<div class="chip-row">' +
      symbols
        .map(function (symbol) {
          return chipHTML(symbol, cycle.symbol === symbol, 'set-symbol', 'data-value="' + esc(symbol) + '"');
        })
        .join('') +
      '</div>' +
      '<p class="muted" style="margin:14px 0 0">Риск на сделку — ' + fmtMoney(cycle.risk.usd) + ', ступень ' +
      (cycle.risk.step + 1) + '.</p>'
    );
  }

  const rows = [
    ['Символ', cycle.symbol, ''],
    ['Направление', cycle.direction, cycle.direction === 'LONG' ? 'positive' : 'negative'],
    ['Entry', fmtPrice(cycle.entry.entry), ''],
    ['SL', fmtPrice(cycle.entry.sl), 'negative'],
    ['TP', fmtPrice(cycle.entry.tp), 'positive'],
    ['RR', computedRR(cycle) == null ? '—' : computedRR(cycle).toFixed(2), ''],
    ['Риск', fmtMoney(cycle.risk.usd), 'warn']
  ];

  return (
    '<div class="list">' +
    rows
      .map(function (row) {
        return (
          '<div class="list-row"><div class="grow"><div class="list-sub">' + row[0] + '</div></div>' +
          '<div class="mono ' + row[2] + '" style="font-weight:600">' + esc(row[1]) + '</div></div>'
        );
      })
      .join('') +
    '</div>' +
    '<p class="muted" style="margin:14px 0 0">После входа SL и TP не двигаются, частичных закрытий нет. ' +
    'В ' + esc(db.settings.cycleEnd) + ' переведите стоп в BE.</p>'
  );
}

function todaySideHTML(cycle) {
  const step = db.ladder.step;
  const limits = limitsState();
  const todayR = dayR(todayISO());

  const limitsRow = limits.enabled
    ? '<div class="list-row"><div class="grow"><div class="list-sub">Сделок сегодня</div>' +
      '<div class="list-title">' + limits.count + ' / ' + limits.maxTrades + ' · ' + fmtR(limits.r) + ' / ' + fmtR(-limits.maxLoss) + '</div></div>' +
      '<span class="pill ' + (limits.reached ? 'red' : 'green') + '">' + (limits.reached ? 'лимит' : 'ок') + '</span></div>'
    : '';

  const route = STEPS.map(function (item, index) {
    const cls = cycle && index < cycle.step ? 'done' : cycle && index === cycle.step ? 'current' : '';
    return '<span class="' + cls + '">' + item.num + '</span>';
  }).join('');

  return (
    '<div class="stack">' +
    '<div class="card"><div class="card-head"><h3>Risk Ladder</h3><span class="spacer"></span>' +
    '<span class="pill accent">' + (step + 1) + ' / 3</span></div>' +
    '<div class="label">Риск на сделку</div>' +
    '<div class="kpi">' + fmtMoney(ladderAmount(step)) + '</div>' +
    '<div class="row" style="margin-top:10px"><span class="pill ' + (db.ladder.accR >= 0 ? 'green' : 'red') + '">' +
    fmtR(db.ladder.accR) + ' в ступени</span>' +
    '<span class="pill">до ' + (step < 2 ? fmtMoney(ladderAmount(step + 1)) : 'потолок') + '</span></div>' +
    '<div class="divider"></div>' +
    '<div class="row between"><span class="muted">Сегодня</span>' +
    '<span class="mono ' + rClass(todayR) + '" style="font-weight:600">' + fmtR(todayR) + '</span></div>' +
    limitsRow +
    '</div>' +
    '<div class="card tight"><div class="card-title">Маршрут дня</div>' +
    '<div class="step-rail">' + route + '</div></div>' +
    '<div class="card tight"><div class="card-title">Быстрые ссылки</div>' +
    '<div class="list">' +
    '<div class="list-row"><div class="grow"><div class="list-title">Уровни</div>' +
    '<div class="list-sub">Библиотека Key Levels</div></div>' +
    '<button class="btn btn-sm" data-act="nav" data-view="levels">Открыть</button></div>' +
    '<div class="list-row"><div class="grow"><div class="list-title">Цель месяца</div>' +
    '<div class="list-sub">' + goalSubtitle() + '</div></div>' +
    '<button class="btn btn-sm" data-act="nav" data-view="goal">Открыть</button></div>' +
    '<div class="list-row"><div class="grow"><div class="list-title">Статистика</div>' +
    '<div class="list-sub">Разбивки и графики</div></div>' +
    '<button class="btn btn-sm" data-act="nav" data-view="stats">Открыть</button></div>' +
    '</div></div>' +
    '</div>'
  );
}

function dayResultHTML(cycle) {
  const trade = tradeById(cycle.tradeId);
  const rows = [
    ['Символ', cycle.symbol],
    ['Направление', cycle.direction],
    ['Entry', fmtPrice(cycle.entry.entry)],
    ['SL', fmtPrice(cycle.entry.sl)],
    ['TP', fmtPrice(cycle.entry.tp)],
    ['RR', computedRR(cycle) == null ? '—' : computedRR(cycle).toFixed(2)],
    ['Риск', fmtMoney(cycle.risk.usd)]
  ];

  if (trade) {
    rows.splice(2, 0, ['Время входа', new Date(trade.entryDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })]);
    if (trade.result !== 'open') {
      rows.push(['Результат', trade.result]);
      rows.push(['Факт R', fmtR(trade.actualR)]);
    }
  }

  const status = cycle.stopDay
    ? 'STOP DAY · новых входов в этот день нет'
    : trade && trade.result !== 'open'
      ? 'Сделка закрыта: ' + trade.result
      : 'Сделка открыта — ждём TP или SL';

  return (
    '<div class="card">' +
    '<div class="card-head"><h3>Итог дня</h3><span class="spacer"></span>' +
    '<span class="pill ' + (cycle.stopDay ? 'red' : 'green') + '">' + (cycle.stopDay ? 'STOP DAY' : 'План выполнен') + '</span></div>' +
    '<p class="muted" style="margin:0 0 14px">' + esc(status) + '</p>' +
    '<div class="list">' +
    rows
      .map(function (row) {
        return (
          '<div class="list-row"><div class="grow"><div class="list-sub">' + row[0] + '</div></div>' +
          '<div class="mono" style="font-weight:600">' + esc(row[1]) + '</div></div>'
        );
      })
      .join('') +
    '</div>' +
    (trade && trade.result === 'open'
      ? '<div class="row" style="margin-top:16px"><button class="btn" data-act="close-trade" data-id="' + trade.id + '">Закрыть сделку</button>' +
        '<button class="btn" data-act="move-be" data-id="' + trade.id + '">Перевести в BE</button></div>'
      : '') +
    '<div style="margin-top:16px"><button class="btn btn-ghost" data-act="nav" data-view="stats">Смотреть статистику →</button></div>' +
    '</div>' +
    '<div class="card tight"><div class="card-title">Следующий шаг</div>' +
    '<p class="muted" style="margin:0">Следующий цикл стартует в ' + esc(db.settings.cycleStart) + ' — до этого времени новых входов нет.</p></div>'
  );
}

function goalSubtitle() {
  const key = monthKey(todayISO());
  const target = Number(db.goals[key]) || 10;
  const current = db.trades
    .filter(function (trade) {
      return trade.result !== 'open' && monthKey(trade.tradeDay) === key;
    })
    .reduce(function (sum, trade) {
      return sum + (Number(trade.actualR) || 0);
    }, 0);
  return fmtR(current) + ' из ' + target + 'R';
}


/* =========================================================
   10. Экран «Сделки»
   ========================================================= */

function filteredTrades() {
  const query = ui.search.trim().toLowerCase();
  return db.trades
    .slice()
    .sort(function (a, b) {
      return closeTime(b) - closeTime(a);
    })
    .filter(function (trade) {
      if (ui.tradeFilter === 'open' && trade.result !== 'open') return false;
      if (ui.tradeFilter === 'closed' && trade.result === 'open') return false;
      if (!query) return true;
      const haystack = (trade.symbol + ' ' + (trade.note || '') + ' ' + (trade.tags || []).join(' ')).toLowerCase();
      return haystack.indexOf(query) >= 0;
    });
}

function resultPill(trade) {
  if (trade.result === 'open') return '<span class="pill accent">открыта</span>';
  if (trade.result === 'TP') return '<span class="pill green">TP</span>';
  if (trade.result === 'SL') return '<span class="pill red">SL</span>';
  return '<span class="pill orange">BE</span>';
}

function tradesView() {
  const list = filteredTrades();
  const openCount = db.trades.filter(function (t) {
    return t.result === 'open';
  }).length;
  const todayR = dayR(todayISO());

  const rows = list
    .map(function (trade) {
      return (
        '<tr>' +
        '<td><div class="list-title">' + esc(trade.symbol) + '</div>' +
        '<div class="list-sub">' + esc(trade.direction) + ' · ступень ' + (Number(trade.ladderStep) + 1) + '</div></td>' +
        '<td class="mono muted">' + fmtDay(trade.tradeDay) + '</td>' +
        '<td class="mono">' + fmtPrice(trade.entry) + '<div class="list-sub">SL ' + fmtPrice(trade.currentStop) +
        ' → TP ' + fmtPrice(trade.tp) + '</div></td>' +
        '<td class="mono">' + (trade.plannedRR == null ? '—' : Number(trade.plannedRR).toFixed(2)) + '</td>' +
        '<td class="mono muted">' + fmtMoney(trade.riskUSD) + '</td>' +
        '<td class="mono ' + rClass(trade.result === 'open' ? 0 : trade.actualR) + '"><b>' +
        (trade.result === 'open' ? '—' : fmtR(trade.actualR)) + '</b></td>' +
        '<td>' + resultPill(trade) + '</td>' +
        '<td><div class="row" style="gap:6px;justify-content:flex-end">' +
        (trade.result === 'open'
          ? '<button class="btn btn-sm" data-act="close-trade" data-id="' + trade.id + '">Закрыть</button>' +
            '<button class="btn btn-sm btn-ghost" data-act="move-be" data-id="' + trade.id + '">BE</button>'
          : '<button class="btn btn-sm btn-ghost" data-act="trade-note" data-id="' + trade.id + '">Метки</button>') +
        '</div></td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="stack">' +
    '<div class="grid grid-3">' +
    '<div class="card tight"><div class="label">Открыто</div><div class="kpi sm">' + openCount + '</div></div>' +
    '<div class="card tight"><div class="label">Сегодня, R</div><div class="kpi sm ' + rClass(todayR) + '">' + fmtR(todayR) + '</div></div>' +
    '<div class="card tight"><div class="label">Всего сделок</div><div class="kpi sm">' + db.trades.length + '</div></div>' +
    '</div>' +
    '<div class="row" style="gap:14px">' +
    '<div class="segmented">' +
    ['all', 'open', 'closed']
      .map(function (key) {
        const label = key === 'all' ? 'Все' : key === 'open' ? 'Открытые' : 'Закрытые';
        return '<button class="' + (ui.tradeFilter === key ? 'active' : '') + '" data-act="trade-filter" data-value="' + key + '">' + label + '</button>';
      })
      .join('') +
    '</div>' +
    '<input class="input" style="max-width:320px" type="search" placeholder="Поиск по символу, заметке или метке" value="' +
    esc(ui.search) + '" data-act="trade-search">' +
    '</div>' +
    '<div class="card tight">' +
    (list.length
      ? '<table class="table"><thead><tr>' +
        '<th>Сделка</th><th>День</th><th>Цены</th><th>RR</th><th>Риск</th><th>R</th><th>Результат</th><th></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div class="empty">Сделок нет. Откройте сделку из цикла на шаге ENTRY или добавьте вручную.</div>') +
    '</div>' +
    '</div>'
  );
}

/* =========================================================
   11. Экран «Risk Ladder»
   ========================================================= */

function ladderEvents() {
  const closed = closedTrades().slice().sort(function (a, b) {
    return closeTime(a) - closeTime(b);
  });

  let step = 0;
  let acc = 0;
  const events = [];

  closed.forEach(function (trade) {
    const r = Number(trade.actualR) || 0;
    if (r > 0.05) {
      acc += r;
      if (acc >= 2 - 1e-9) {
        if (step < 2) {
          events.push({ day: trade.tradeDay, from: step, to: step + 1, text: 'TP ' + fmtR(r) + ' — набрано +2R' });
          step += 1;
        } else {
          events.push({ day: trade.tradeDay, from: step, to: step, text: 'TP на потолке — остаёмся' });
        }
        acc = 0;
      }
    } else if (r < -0.05) {
      acc = 0;
      if (step > 0) {
        events.push({ day: trade.tradeDay, from: step, to: 0, text: 'SL ' + fmtR(r) + ' — сброс на старт' });
        step = 0;
      }
    }
  });

  return events.slice(-8).reverse();
}

function ladderView() {
  const current = db.ladder.step;
  const amounts = db.settings.ladder;
  const accProgress = Math.min(1, Math.max(0, db.ladder.accR / 2));

  const stepsHTML = amounts
    .map(function (amount, index) {
      const active = index === current;
      return (
        '<div class="card" style="' + (active ? 'border-color:rgba(124,107,255,0.55);background:rgba(124,107,255,0.10)' : '') + '">' +
        '<div class="row between"><span class="label">Ступень ' + (index + 1) + '</span>' +
        (active ? '<span class="pill accent">текущая</span>' : '<span class="pill">' + (index < current ? 'пройдена' : 'впереди') + '</span>') +
        '</div>' +
        '<div class="kpi" style="margin-top:8px">' + fmtMoney(amount) + '</div>' +
        '<div class="list-sub">риск на сделку</div>' +
        '</div>'
      );
    })
    .join('');

  const events = ladderEvents();
  const eventsHTML = events.length
    ? events
        .map(function (event) {
          const up = event.to >= event.from;
          return (
            '<div class="list-row">' +
            '<span class="pill ' + (event.to > event.from ? 'green' : event.to < event.from ? 'red' : '') + '">' +
            (event.to > event.from ? '↑' : event.to < event.from ? '↓' : '•') + '</span>' +
            '<div class="grow"><div class="list-title">Ступень ' + (event.from + 1) + ' → ' + (event.to + 1) + '</div>' +
            '<div class="list-sub">' + fmtDay(event.day) + ' · ' + esc(event.text) + '</div></div>' +
            '</div>'
          );
        })
        .join('')
    : '<div class="empty">Переходов пока не было.</div>';

  return (
    '<div class="stack">' +
    '<div class="card"><div class="row between">' +
    '<div><div class="label">Следующая сделка</div><div class="kpi">' + fmtMoney(amounts[current]) + '</div>' +
    '<div class="list-sub">Ступень ' + (current + 1) + ' из 3</div></div>' +
    '<div style="min-width:240px">' +
    '<div class="row between" style="margin-bottom:6px"><span class="label">Накоплено в ступени</span>' +
    '<span class="mono ' + rClass(db.ladder.accR) + '">' + fmtR(db.ladder.accR) + ' / 2.0R</span></div>' +
    '<div class="progress"><i style="width:' + accProgress * 100 + '%"></i></div>' +
    '</div></div></div>' +
    '<div class="grid grid-3">' + stepsHTML + '</div>' +
    '<div class="grid grid-2">' +
    '<div class="card tight"><div class="card-title">Правила ступеней</div>' +
    '<div class="list">' +
    '<div class="list-row"><div class="grow"><div class="list-title">Внутри ступени</div><div class="list-sub">R суммируются; +2R — переход выше и сброс накопления</div></div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-title">SL на ступени 1</div><div class="list-sub">Остаёмся на $' + Number(amounts[0]) + '</div></div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-title">SL на ступени 2</div><div class="list-sub">Следующий вход $' + Number(amounts[0]) + '</div></div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-title">Потолок</div><div class="list-sub">После TP остаёмся на $' + Number(amounts[2]) + ', после SL — $' + Number(amounts[0]) + '</div></div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-title">BE</div><div class="list-sub">Ступень не меняет</div></div></div>' +
    '</div></div>' +
    '<div class="card tight"><div class="card-title">История переходов</div><div class="list">' + eventsHTML + '</div></div>' +
    '</div>' +
    '</div>'
  );
}

/* =========================================================
   12. Экран «Статистика»
   ========================================================= */

function chartSVG(stats) {
  const points = stats.chart;
  if (!points.length) {
    return '<div class="empty">Пока нет закрытых сделок</div>';
  }

  const width = 760;
  const height = 220;
  const pad = 16;
  let min = 0;
  let max = 0;
  points.forEach(function (p) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  });
  if (max - min < 1) max = min + 1;

  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);
  const y = function (value) {
    return height - pad - ((value - min) / (max - min)) * (height - pad * 2);
  };
  const zero = y(0);

  const path = points
    .map(function (p, index) {
      return (index === 0 ? 'M' : 'L') + (pad + index * stepX).toFixed(1) + ' ' + y(p.value).toFixed(1);
    })
    .join(' ');

  const area = path + ' L' + (pad + (points.length - 1) * stepX).toFixed(1) + ' ' + zero.toFixed(1) +
    ' L' + pad + ' ' + zero.toFixed(1) + ' Z';

  const last = points[points.length - 1].value;
  const color = colorForR(last);

  return (
    '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto">' +
    '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.28"/>' +
    '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="' + pad + '" x2="' + (width - pad) + '" y1="' + zero.toFixed(1) + '" y2="' + zero.toFixed(1) +
    '" stroke="rgba(255,255,255,0.14)" stroke-dasharray="4 4"/>' +
    '<path d="' + area + '" fill="url(#areaGrad)"/>' +
    '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    '</svg>'
  );
}

function breakdownRowsHTML(groups, kind) {
  return groups
    .filter(function (group) {
      return group.count > 0;
    })
    .map(function (group) {
      return (
        '<div class="list-row">' +
        '<div class="grow"><div class="list-title">' + esc(group.title) + '</div>' +
        '<div class="list-sub">' + dealsWord(group.count) + '</div></div>' +
        '<div class="mono muted" style="min-width:48px;text-align:right">' + fmtPercent(group.winRate) + '</div>' +
        '<div class="mono ' + rClass(group.totalR) + '" style="min-width:62px;text-align:right;font-weight:600">' +
        fmtR(group.totalR) + '</div>' + rowBar(group.wins, group.losses, group.count) +
        '</div>'
      );
    })
    .join('');
}

function statsView() {
  const stats = buildStats(ui.period);
  const periods = [
    { key: 'today', label: 'Сегодня' },
    { key: 'week', label: 'Неделя' },
    { key: 'all', label: 'Всё' }
  ];

  if (!stats.count) {
    return (
      '<div class="stack">' +
      '<div class="segmented">' +
      periods
        .map(function (p) {
          return '<button class="' + (ui.period === p.key ? 'active' : '') + '" data-act="set-period" data-value="' + p.key + '">' + p.label + '</button>';
        })
        .join('') +
      '</div>' +
      '<div class="card"><div class="empty" style="border:0">Пока нет закрытых сделок за этот период. Закройте позицию в «Сделках» — здесь появятся цифры.</div></div>' +
      '</div>'
    );
  }

  const best = stats.streaks.best;
  const worst = stats.streaks.worst;

  const sections = [
    { title: 'По символам', groups: stats.bySymbol },
    { title: 'По направлениям', groups: stats.byDirection },
    { title: 'По ступеням риска', groups: stats.byStep },
    { title: 'По дням недели', groups: stats.byWeekday.filter(function (g) { return g.count > 0; }) },
    { title: 'По времени входа', groups: stats.byHour },
    { title: 'По меткам', groups: stats.byTag }
  ]
    .filter(function (section) {
      return section.groups.some(function (g) {
        return g.count > 0;
      });
    })
    .map(function (section) {
      return (
        '<div class="card tight"><div class="card-title">' + section.title + '</div>' +
        '<div class="list">' + breakdownRowsHTML(section.groups) + '</div></div>'
      );
    })
    .join('');

  return (
    '<div class="stack">' +
    '<div class="row" style="justify-content:space-between">' +
    '<div class="segmented">' +
    periods
      .map(function (p) {
        return '<button class="' + (ui.period === p.key ? 'active' : '') + '" data-act="set-period" data-value="' + p.key + '">' + p.label + '</button>';
      })
      .join('') +
    '</div>' +
    '<span class="muted">' + dealsWord(stats.trades.length) + ' закрыто</span>' +
    '</div>' +
    '<div class="grid grid-4">' +
    '<div class="card tight"><div class="label">Win rate</div><div class="kpi sm positive">' + fmtPercent(stats.winRate) + '</div>' +
    '<div class="list-sub">' + stats.wins + ' из ' + stats.count + '</div></div>' +
    '<div class="card tight"><div class="label">Суммарный R</div><div class="kpi sm ' + rClass(stats.totalR) + '">' + fmtR(stats.totalR) + '</div>' +
    '<div class="list-sub">' + dealsWord(stats.count) + '</div></div>' +
    '<div class="card tight"><div class="label">Средний R</div><div class="kpi sm">' + fmtSigned(stats.averageR, 2) + '</div>' +
    '<div class="list-sub">на сделку</div></div>' +
    '<div class="card tight"><div class="label">Profit factor</div><div class="kpi sm">' +
    (stats.profitFactor == null ? '—' : stats.profitFactor.toFixed(1)) + '</div>' +
    '<div class="list-sub">плюсы / минусы</div></div>' +
    '</div>' +
    '<div class="grid grid-2">' +
    '<div class="card tight"><div class="card-title">Лучшая серия</div><div class="kpi sm positive">' +
    (best.count ? '+' + best.count + ' ' + dealsWord(best.count).replace(/^\d+\s/, '') + ' / ' + fmtR(best.totalR) : '—') +
    '</div></div>' +
    '<div class="card tight"><div class="card-title">Худшая серия</div><div class="kpi sm negative">' +
    (worst.count ? '\u2212' + worst.count + ' / ' + fmtR(worst.totalR) : '—') + '</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-head"><h3>Накопленный R</h3><span class="spacer"></span>' +
    '<span class="mono ' + rClass(stats.totalR) + '" style="font-size:20px;font-weight:650">' + fmtR(stats.totalR) + '</span></div>' +
    chartSVG(stats) + '</div>' +
    '<div class="grid grid-2">' + sections + '</div>' +
    '</div>'
  );
}


/* =========================================================
   13. Экран «Календарь»
   ========================================================= */

function monthDays(monthISO) {
  const date = dateFromISO(monthISO);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  }
  return cells;
}

function cycleOfDay(iso) {
  return (
    db.cycles.find(function (cycle) {
      return cycle.day === iso;
    }) || null
  );
}

function dayResult(iso) {
  const cycle = cycleOfDay(iso);
  const trades = tradesOfDay(iso);
  const closed = trades.filter(function (t) {
    return t.result !== 'open';
  });
  const r = closed.reduce(function (sum, t) {
    return sum + (Number(t.actualR) || 0);
  }, 0);

  if (!cycle && !trades.length) return { label: '', r: 0, kind: 'none', cycle: null };
  if (cycle && cycle.stopDay) return { label: 'STOP DAY', r: r, kind: 'stop', cycle: cycle };
  if (closed.length) {
    const last = closed[closed.length - 1];
    return { label: last.result, r: r, kind: last.result === 'TP' ? 'good' : last.result === 'SL' ? 'bad' : 'be', cycle: cycle };
  }
  if (trades.length) return { label: 'открыта', r: 0, kind: 'open', cycle: cycle };
  if (cycle) return { label: 'цикл', r: 0, kind: 'none', cycle: cycle };
  return { label: '', r: 0, kind: 'none', cycle: null };
}

function calendarView() {
  const cells = monthDays(ui.calendarMonth);
  const monthCycles = db.cycles.filter(function (cycle) {
    return monthKey(cycle.day) === monthKey(ui.calendarMonth);
  });
  const monthClosed = closedTrades().filter(function (trade) {
    return monthKey(trade.tradeDay) === monthKey(ui.calendarMonth);
  });
  const monthR = monthClosed.reduce(function (sum, t) {
    return sum + (Number(t.actualR) || 0);
  }, 0);

  const head = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']
    .map(function (dow) {
      return '<div class="dow">' + dow + '</div>';
    })
    .join('');

  const grid = cells
    .map(function (date) {
      if (!date) return '<div class="day empty"></div>';
      const iso = isoDate(date);
      const info = dayResult(iso);
      const isToday = iso === todayISO();
      const color =
        info.kind === 'good' || info.kind === 'open'
          ? 'var(--green)'
          : info.kind === 'bad'
            ? 'var(--red)'
            : info.kind === 'be'
              ? 'var(--orange)'
              : info.kind === 'stop'
                ? 'var(--red)'
                : 'var(--muted)';
      return (
        '<div class="day ' + (isToday ? 'today' : '') + '" data-act="open-day" data-day="' + iso + '">' +
        '<div class="num">' + date.getDate() + '</div>' +
        (info.label ? '<div class="tag" style="color:' + (info.kind === 'none' ? 'var(--dim)' : color) + '">' + esc(info.label) + '</div>' : '') +
        (info.label && info.kind !== 'none' ? '<div class="res" style="color:' + color + '">' + (info.r ? fmtR(info.r) : '0.0R') + '</div>' : '') +
        '</div>'
      );
    })
    .join('');

  const selected = ui.selectedDay ? dayDetailHTML(ui.selectedDay) : '';

  return (
    '<div class="stack">' +
    '<div class="card tight"><div class="row between">' +
    '<div class="row"><button class="btn icon-btn" data-act="month-prev">←</button>' +
    '<button class="btn icon-btn" data-act="month-next">→</button>' +
    '<div style="margin-left:8px"><div class="list-title">' + fmtMonthTitle(ui.calendarMonth) + '</div>' +
    '<div class="list-sub">' + monthsWord(monthCycles.length) + '</div></div></div>' +
    '<div class="row"><span class="pill ' + rClass(monthR) + '">' + fmtR(monthR) + ' за месяц</span></div>' +
    '</div></div>' +
    '<div class="card tight"><div class="calendar">' + head + grid + '</div></div>' +
    selected +
    '</div>'
  );
}

function monthsWord(count) {
  const n = Math.abs(count) % 100;
  const k = Math.abs(count) % 10;
  if (n >= 11 && n <= 14) return count + ' торговых дней';
  if (k === 1) return count + ' торговый день';
  if (k >= 2 && k <= 4) return count + ' торговых дня';
  return count + ' торговых дней';
}

function dayDetailHTML(iso) {
  const cycle = cycleOfDay(iso);
  const trades = tradesOfDay(iso);
  const info = dayResult(iso);

  const tradesHTML = trades.length
    ? trades
        .map(function (trade) {
          return (
            '<div class="list-row"><div class="grow"><div class="list-title">' + esc(trade.symbol) + ' · ' + esc(trade.direction) + '</div>' +
            '<div class="list-sub">entry ' + fmtPrice(trade.entry) + ' · TP ' + fmtPrice(trade.tp) +
            (trade.result === 'open' ? '' : ' · ' + trade.result) + '</div></div>' +
            '<span class="mono ' + rClass(trade.result === 'open' ? 0 : trade.actualR) + '" style="font-weight:600">' +
            (trade.result === 'open' ? '—' : fmtR(trade.actualR)) + '</span></div>'
          );
        })
        .join('')
    : '<div class="empty">Сделок в этот день нет.</div>';

  return (
    '<div class="card"><div class="card-head"><h3>' + fmtDay(iso) + '</h3><span class="spacer"></span>' +
    '<span class="pill ' + (info.kind === 'bad' || info.kind === 'stop' ? 'red' : info.kind === 'be' ? 'orange' : 'green') + '">' +
    (info.label || 'Нет данных') + '</span></div>' +
    (cycle
      ? '<div class="grid grid-4" style="margin-bottom:14px">' +
        '<div class="card tight"><div class="label">Направление</div><div class="kpi sm">' + esc(cycle.direction) + '</div></div>' +
        '<div class="card tight"><div class="label">Поток</div><div class="kpi sm">' + esc(cycle.trend) + '</div></div>' +
        '<div class="card tight"><div class="label">Зона</div><div class="kpi sm">' + (zoneOf(cycle) || '—') + '</div></div>' +
        '<div class="card tight"><div class="label">R дня</div><div class="kpi sm ' + rClass(info.r) + '">' + fmtR(info.r) + '</div></div>' +
        '</div>'
      : '') +
    '<div class="list">' + tradesHTML + '</div>' +
    (cycle
      ? '<p class="muted" style="margin:14px 0 0">Сценарий: A ' + fmtPrice(cycle.a.price) + ' → B ' + fmtPrice(cycle.b.price) + '</p>'
      : '') +
    '</div>'
  );
}

/* =========================================================
   14. Экран «Цель месяца»
   ========================================================= */

function goalData() {
  const key = monthKey(todayISO());
  const target = Number(db.goals[key]) || 10;
  const trades = db.trades.filter(function (trade) {
    return trade.result !== 'open' && monthKey(trade.tradeDay) === key;
  });
  const value = trades.reduce(function (sum, trade) {
    return sum + (Number(trade.actualR) || 0);
  }, 0);
  const remaining = Math.max(target - value, 0);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let tradingDaysLeft = 0;
  for (let day = today.getDate(); day <= daysInMonth; day += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    if (date.getDay() !== 0 && date.getDay() !== 6) tradingDaysLeft += 1;
  }

  return {
    key: key,
    target: target,
    value: value,
    remaining: remaining,
    perDay: remaining / Math.max(1, tradingDaysLeft),
    percent: Math.min(1, Math.max(0, target > 0 ? value / target : 0))
  };
}

function goalRingHTML(percent, value, target) {
  const size = 260;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * percent;

  return (
    '<div class="goal-ring">' +
    '<svg width="' + size + '" height="' + size + '">' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius + '" fill="none" ' +
    'stroke="rgba(255,255,255,0.07)" stroke-width="' + stroke + '"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + radius + '" fill="none" ' +
    'stroke="url(#goalGrad)" stroke-width="' + stroke + '" stroke-linecap="round" ' +
    'stroke-dasharray="' + dash.toFixed(1) + ' ' + circumference.toFixed(1) + '" ' +
    'style="filter:drop-shadow(0 0 12px rgba(124,107,255,0.55))"/>' +
    '<defs><linearGradient id="goalGrad" x1="0" y1="1" x2="1" y2="0">' +
    '<stop offset="0%" stop-color="#6a58f0"/><stop offset="100%" stop-color="#a99cff"/></linearGradient></defs>' +
    '</svg>' +
    '<div class="center"><div><div class="value">' + fmtPlainR(value) + '</div>' +
    '<div class="of">из ' + target + 'R</div></div></div>' +
    '</div>'
  );
}

function goalView() {
  const goal = goalData();
  const months = pastMonths();

  const rows = months.length
    ? months
        .map(function (item) {
          const reached = item.target != null && item.r >= item.target;
          return (
            '<div class="list-row">' +
            '<div class="grow"><div class="list-title">' + item.title + '</div>' +
            '<div class="list-sub">' + fmtR(item.r) + ' · цель ' + (item.target == null ? '—' : item.target + 'R') + '</div></div>' +
            '<span class="pill ' + (reached ? 'green' : '') + '">' + (reached ? '✓' : '×') + '</span>' +
            '</div>'
          );
        })
        .join('')
    : '<div class="empty">Пока нет прошлых месяцев.</div>';

  return (
    '<div class="stack">' +
    '<div class="card"><div class="row between" style="align-items:flex-start">' +
    '<div><div class="card-title" style="margin-bottom:4px">' + fmtMonthTitle(todayISO()) + '</div>' +
    '<h3 style="margin:0;font-size:20px">Цель по R</h3></div>' +
    '<div class="row"><input class="input mono" style="width:110px" type="number" min="1" step="1" value="' + goal.target +
    '" data-bind="__goal" data-kind="goal"><button class="btn btn-primary" data-act="save-goal">Сохранить цель</button></div>' +
    '</div>' +
    '<div style="padding:22px 0 8px">' + goalRingHTML(goal.percent, goal.value, goal.target) + '</div>' +
    '<div style="text-align:center" class="muted">' +
    (goal.remaining <= 0.05
      ? 'Цель выполнена · ' + fmtR(goal.value) + ' из ' + goal.target + 'R'
      : 'Осталось ' + fmtR(goal.remaining) + ' · по ' + goal.perDay.toFixed(1) + 'R на торговый день') +
    '</div></div>' +
    '<div class="card tight"><div class="card-title">Прошлые месяцы</div><div class="list">' + rows + '</div></div>' +
    '</div>'
  );
}

function pastMonths() {
  const keys = {};
  closedTrades().forEach(function (trade) {
    keys[monthKey(trade.tradeDay)] = true;
  });
  Object.keys(db.goals).forEach(function (key) {
    keys[key] = true;
  });

  const current = monthKey(todayISO());
  return Object.keys(keys)
    .filter(function (key) {
      return key !== current;
    })
    .sort()
    .reverse()
    .map(function (key) {
      const monthTrades = closedTrades().filter(function (trade) {
        return monthKey(trade.tradeDay) === key;
      });
      const r = monthTrades.reduce(function (sum, trade) {
        return sum + (Number(trade.actualR) || 0);
      }, 0);
      return {
        key: key,
        title: fmtMonthName(key + '-01') + ' ' + key.slice(0, 4),
        r: r,
        target: db.goals[key] == null ? null : Number(db.goals[key])
      };
    });
}

/* =========================================================
   15. Экран «Уровни»
   ========================================================= */

function allLevels() {
  const items = [];
  db.cycles.forEach(function (cycle) {
    (cycle.levels || []).forEach(function (level) {
      items.push({ level: level, cycle: cycle });
    });
  });
  return items;
}

function levelsView() {
  const items = allLevels().filter(function (item) {
    if (ui.onlyActive && item.level.absorbed) return false;
    if (ui.levelType !== 'all' && item.level.type !== ui.levelType) return false;
    return true;
  });

  const activeCount = allLevels().filter(function (item) {
    return !item.level.absorbed;
  }).length;
  const absorbedCount = allLevels().length - activeCount;

  const grouped = {};
  items.forEach(function (item) {
    const day = item.cycle.day;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(item);
  });

  const days = Object.keys(grouped).sort().reverse();
  const groupsHTML = days
    .map(function (day) {
      const rows = grouped[day]
        .map(function (item) {
          const level = item.level;
          const reference = num(item.cycle.price) != null ? num(item.cycle.price) : drMid(item.cycle);
          let distance = '—';
          if (reference) {
            const diff = Number(level.price) - reference;
            const percent = (Math.abs(diff) / reference) * 100;
            distance = (diff > 0 ? '+' : diff < 0 ? '\u2212' : '') + percent.toFixed(2) + '%';
          }
          return (
            '<div class="list-row">' +
            '<span class="level-dot" style="background:' + levelColor(level.type) + '"></span>' +
            '<div class="grow"><div class="list-title">' + esc(level.type) + ' · ' + fmtPrice(level.price) + '</div>' +
            '<div class="list-sub">' + (level.note ? esc(level.note) : 'без заметки') + '</div></div>' +
            '<span class="mono muted">' + distance + '</span>' +
            '<span class="pill ' + (level.absorbed ? '' : 'green') + '">' + (level.absorbed ? 'поглощён' : 'активен') + '</span>' +
            '<button class="btn btn-sm btn-ghost" data-act="open-cycle" data-id="' + item.cycle.id + '">Цикл</button>' +
            '</div>'
          );
        })
        .join('');
      return (
        '<div class="card tight"><div class="card-title">' + fmtDay(day) + '</div>' +
        '<div class="list">' + rows + '</div></div>'
      );
    })
    .join('');

  const chips =
    chipHTML('Все', ui.levelType === 'all', 'level-type', 'data-value="all"') +
    LEVEL_TYPES.map(function (type) {
      return chipHTML(type.key, ui.levelType === type.key, 'level-type', 'data-value="' + type.key + '"');
    }).join('');

  return (
    '<div class="stack">' +
    '<div class="row between">' +
    '<div class="chip-row">' + chips + '</div>' +
    '<button class="btn ' + (ui.onlyActive ? 'btn-primary' : '') + '" data-act="toggle-active">' +
    'Только активные</button>' +
    '</div>' +
    '<div class="row"><span class="pill green">' + activeCount + ' активных</span>' +
    '<span class="pill">' + absorbedCount + ' погашено</span></div>' +
    (groupsHTML || '<div class="card"><div class="empty" style="border:0">Пока нет уровней. Добавьте Key Levels в цикле на шаге KEY LEVELS.</div></div>') +
    '</div>'
  );
}

/* =========================================================
   16. Экран «Настройки»
   ========================================================= */

function settingsView() {
  const symbols = db.settings.symbols
    .map(function (symbol) {
      return (
        '<div class="list-row"><div class="grow"><div class="list-title">' + esc(symbol) + '</div></div>' +
        '<button class="btn btn-sm btn-danger" data-act="remove-symbol" data-value="' + esc(symbol) + '">Удалить</button></div>'
      );
    })
    .join('');

  const limits = db.settings.limits;

  return (
    '<div class="stack">' +
    '<div class="card tight"><div class="card-title">Символы</div>' +
    '<div class="list">' + symbols + '</div>' +
    '<div class="row" style="margin-top:12px">' +
    '<input class="input" id="new-symbol" placeholder="Например EURUSD">' +
    '<button class="btn" data-act="add-symbol">Добавить</button></div></div>' +

    '<div class="grid grid-2">' +
    '<div class="card tight"><div class="card-title">Время цикла</div>' +
    '<div class="form-grid">' +
    fieldHTML('Старт цикла', inputHTML('settings.cycleStart', db.settings.cycleStart, { type: 'time' })) +
    fieldHTML('Закрытие терминала', inputHTML('settings.cycleEnd', db.settings.cycleEnd, { type: 'time' })) +
    '</div>' +
    '<p class="muted" style="margin:12px 0 0">Напоминания о старте и закрытии терминала доступны в iOS-версии.</p></div>' +

    '<div class="card tight"><div class="card-title">Ступени риска</div>' +
    '<div class="form-grid" style="grid-template-columns:repeat(3,1fr)">' +
    fieldHTML('Ступень 1', inputHTML('settings.ladder.0', db.settings.ladder[0], { type: 'number', mono: true, step: '1' })) +
    fieldHTML('Ступень 2', inputHTML('settings.ladder.1', db.settings.ladder[1], { type: 'number', mono: true, step: '1' })) +
    fieldHTML('Ступень 3', inputHTML('settings.ladder.2', db.settings.ladder[2], { type: 'number', mono: true, step: '1' })) +
    '</div>' +
    '<p class="muted" style="margin:12px 0 0">+2R внутри ступени — переход выше.</p></div>' +
    '</div>' +

    '<div class="grid grid-2">' +
    '<div class="card tight"><div class="card-title">Сделка</div>' +
    '<div class="form-grid">' +
    fieldHTML('Минимальный RR', inputHTML('settings.minRR', db.settings.minRR, { type: 'number', mono: true, step: '0.1' })) +
    '<div class="field"><span>Подсказка</span><div class="input mono">' + Number(db.settings.minRR).toFixed(2) + '</div></div>' +
    '</div>' +
    '<p class="muted" style="margin:12px 0 0">Вход блокируется, если расчётный RR ниже минимума.</p></div>' +

    '<div class="card tight"><div class="card-title">Лимиты дня</div>' +
    '<div class="row between" style="margin-bottom:12px"><span class="muted">Включить лимиты</span>' +
    '<button class="switch ' + (limits.enabled ? 'on' : '') + '" data-act="toggle-limits"></button></div>' +
    '<div class="form-grid">' +
    fieldHTML('Максимальный убыток, R', inputHTML('settings.limits.maxLossR', limits.maxLossR, { type: 'number', mono: true, step: '0.5' })) +
    fieldHTML('Сделок за день', inputHTML('settings.limits.maxTrades', limits.maxTrades, { type: 'number', mono: true, step: '1' })) +
    '</div>' +
    '<p class="muted" style="margin:12px 0 0">Достигнутый лимит блокирует новые входы до следующего цикла.</p></div>' +
    '</div>' +

    '<div class="card tight"><div class="card-title">Данные</div>' +
    '<div class="row">' +
    '<button class="btn" data-act="export">Скачать JSON-копию</button>' +
    '<button class="btn" data-act="import">Восстановить из файла</button>' +
    '<button class="btn" data-act="demo">Демо-данные</button>' +
    '<span class="spacer"></span>' +
    '<button class="btn btn-danger" data-act="reset">Очистить всё</button>' +
    '</div>' +
    '<p class="muted" style="margin:12px 0 0">Всё хранится в этом браузере: localStorage. Копия — один JSON-файл с циклами, уровнями, сделками, целями и настройками.</p></div>' +

    '<div class="card tight"><div class="card-title">Сводка</div>' +
    '<div class="grid grid-4">' +
    '<div><div class="label">Циклов</div><div class="kpi sm">' + db.cycles.length + '</div></div>' +
    '<div><div class="label">Сделок</div><div class="kpi sm">' + db.trades.length + '</div></div>' +
    '<div><div class="label">Уровней</div><div class="kpi sm">' + allLevels().length + '</div></div>' +
    '<div><div class="label">Целей месяцев</div><div class="kpi sm">' + Object.keys(db.goals).length + '</div></div>' +
    '</div></div>' +
    '</div>'
  );
}

function cycleModalHTML(cycle) {
  if (!cycle) return '';
  const trade = tradeById(cycle.tradeId);
  return (
    '<div class="modal"><h2>' + fmtDay(cycle.day) + '</h2>' +
    '<div class="sub">' + esc(cycle.symbol) + ' · ' + esc(cycle.direction) + ' · ' + esc(cycleLabel(cycle)) + '</div>' +
    '<div class="list">' +
    '<div class="list-row"><div class="grow"><div class="list-sub">DR</div></div>' +
    '<div class="mono">' + fmtPrice(cycle.drLow) + ' – ' + fmtPrice(cycle.drHigh) + '</div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-sub">Point A / B</div></div>' +
    '<div class="mono">' + fmtPrice(cycle.a.price) + ' → ' + fmtPrice(cycle.b.price) + '</div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-sub">Entry / SL / TP</div></div>' +
    '<div class="mono">' + fmtPrice(cycle.entry.entry) + ' / ' + fmtPrice(cycle.entry.sl) + ' / ' + fmtPrice(cycle.entry.tp) + '</div></div>' +
    '<div class="list-row"><div class="grow"><div class="list-sub">Key Levels</div></div>' +
    '<div class="mono">' + (cycle.levels || []).length + '</div></div>' +
    (trade
      ? '<div class="list-row"><div class="grow"><div class="list-sub">Сделка</div></div>' +
        '<div class="mono">' + (trade.result === 'open' ? 'открыта' : trade.result + ' · ' + fmtR(trade.actualR)) + '</div></div>'
      : '') +
    '</div>' +
    '<div class="modal-actions"><button class="btn" data-act="close-modal">Закрыть</button></div>' +
    '</div>'
  );
}


/* =========================================================
   17. Модальные окна и тосты
   ========================================================= */

let levelDraft = { type: 'SNR', price: '', note: '' };
let searchFocus = false;
let searchTimer = null;

function openModal(html) {
  const root = document.getElementById('overlay-root');
  root.innerHTML = '<div class="overlay" data-act="overlay">' + html + '</div>';
}

function closeModal() {
  document.getElementById('overlay-root').innerHTML = '';
}

function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  requestAnimationFrame(function () {
    node.classList.add('show');
  });
  setTimeout(function () {
    node.classList.remove('show');
  }, 2200);
}

function closeTradeModal(trade) {
  openModal(
    '<div class="modal"><h2>Закрыть сделку</h2>' +
    '<div class="sub">' + esc(trade.symbol) + ' · ' + esc(trade.direction) + ' · entry ' + fmtPrice(trade.entry) + '</div>' +
    '<div class="row" style="gap:10px">' +
    '<button class="btn btn-primary" style="flex:1;background:linear-gradient(120deg,#43d8a0,#2fb989)" data-act="do-close" data-id="' + trade.id + '" data-result="TP">TP</button>' +
    '<button class="btn" style="flex:1" data-act="do-close" data-id="' + trade.id + '" data-result="BE">BE</button>' +
    '<button class="btn btn-danger" style="flex:1" data-act="do-close" data-id="' + trade.id + '" data-result="SL">SL</button>' +
    '</div>' +
    '<p class="muted" style="margin:16px 0 0">SL — минус 1R и STOP DAY. BE — 0R. TP — плановый RR.</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" data-act="close-modal">Отмена</button></div>' +
    '</div>'
  );
}

function tradeNoteModal(trade) {
  openModal(
    '<div class="modal"><h2>Метки и заметка</h2>' +
    '<div class="sub">' + esc(trade.symbol) + ' · ' + fmtDay(trade.tradeDay) + '</div>' +
    '<div class="field"><span>Метки через запятую</span>' +
    '<input class="input" id="trade-tags" value="' + esc((trade.tags || []).join(', ')) + '" placeholder="A+ setup, news, re-entry"></div>' +
    '<div class="field" style="margin-top:14px"><span>Заметка</span>' +
    '<textarea class="textarea" id="trade-note">' + esc(trade.note || '') + '</textarea></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" data-act="close-modal">Отмена</button>' +
    '<button class="btn btn-primary" data-act="save-trade-note" data-id="' + trade.id + '">Сохранить</button>' +
    '</div></div>'
  );
}

function newTradeModal() {
  const symbols = db.settings.symbols
    .map(function (symbol) {
      return '<option value="' + esc(symbol) + '">' + esc(symbol) + '</option>';
    })
    .join('');

  openModal(
    '<div class="modal"><h2>Новая сделка</h2>' +
    '<div class="sub">Ручной ввод вне цикла · торговый день — сегодня</div>' +
    '<div class="form-grid">' +
    '<label class="field"><span>Символ</span><select class="select" id="nt-symbol">' + symbols + '</select></label>' +
    '<label class="field"><span>Направление</span><select class="select" id="nt-direction"><option>LONG</option><option>SHORT</option></select></label>' +
    '<label class="field"><span>Entry</span><input class="input mono" type="number" step="any" id="nt-entry"></label>' +
    '<label class="field"><span>SL</span><input class="input mono" type="number" step="any" id="nt-sl"></label>' +
    '<label class="field"><span>TP</span><input class="input mono" type="number" step="any" id="nt-tp"></label>' +
    '<label class="field"><span>Риск, $</span><input class="input mono" type="number" step="1" id="nt-risk" value="' +
    ladderAmount(db.ladder.step) + '"></label>' +
    '</div>' +
    '<div class="field" style="margin-top:14px"><span>Заметка</span>' +
    '<textarea class="textarea" id="nt-note" placeholder="Почему входим"></textarea></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" data-act="close-modal">Отмена</button>' +
    '<button class="btn btn-primary" data-act="save-new-trade">Открыть сделку</button>' +
    '</div></div>'
  );
}

/* =========================================================
   18. Действия
   ========================================================= */

function actNextStep() {
  const cycle = draftCycle();
  if (!cycle || !canAdvance(cycle)) return;

  if (stepKey(cycle) === 'entry') {
    openTradeFromCycle(cycle);
    return;
  }

  cycle.step = Math.min(cycle.step + 1, STEPS.length - 1);
  save();
  render();
}

function actPrevStep() {
  const cycle = draftCycle();
  if (!cycle || cycle.step === 0) return;
  cycle.step -= 1;
  save();
  render();
}

function currentStepDraft() {
  return draftCycle();
}

function startCycle() {
  if (todayCycle()) return;
  if (limitsState().reached) {
    toast('Лимит дня · новых входов нет');
    return;
  }
  const cycle = {
    id: uid(),
    day: todayISO(),
    createdAt: Date.now(),
    step: 0,
    news: { eur: false, gbp: false, usd: false, note: '' },
    direction: 'LONG',
    trend: 'OF',
    trendNote: '',
    drHigh: null,
    drLow: null,
    price: null,
    levels: [],
    a: { snr: false, of: false, fractal: false, price: null, depth: null, note: '', valid: true },
    b: { price: null, type: 'Fractal', note: '', valid: true },
    confirmations: {},
    entry: { entry: null, sl: null, tp: null },
    risk: { step: db.ladder.step, usd: ladderAmount(db.ladder.step), accR: db.ladder.accR },
    stopDay: false,
    result: 'draft',
    tradeId: null,
    symbol: db.settings.symbols[0] || 'EURUSD'
  };
  db.cycles.push(cycle);
  saveNow();
  render();
  toast('Цикл начат');
}

function openTradeFromCycle(cycle) {
  if (cycle.stopDay) {
    toast('STOP DAY — входов больше нет');
    return;
  }
  if (limitsState().reached) {
    toast('Лимит дня · новых входов нет');
    return;
  }
  const rr = computedRR(cycle);
  if (rr == null || rr < Number(db.settings.minRR)) {
    toast('RR ниже минимума');
    return;
  }

  const trade = {
    id: uid(),
    cycleId: cycle.id,
    tradeDay: cycle.day,
    entryDate: new Date().toISOString(),
    symbol: cycle.symbol,
    direction: cycle.direction,
    ladderStep: cycle.risk.step,
    riskUSD: cycle.risk.usd,
    entry: num(cycle.entry.entry),
    originalStop: num(cycle.entry.sl),
    currentStop: num(cycle.entry.sl),
    tp: num(cycle.entry.tp),
    plannedRR: rr,
    result: 'open',
    actualR: 0,
    isBE: false,
    tags: [],
    note: cycle.a.note || '',
    closedAt: null
  };

  db.trades.push(trade);
  cycle.result = 'entry';
  cycle.tradeId = trade.id;
  recomputeLadder();
  saveNow();
  render();
  toast('Сделка открыта');
}

function closeTrade(trade, result) {
  if (!trade) return;
  if (result === 'TP') trade.actualR = Number(trade.plannedRR) || 0;
  else if (result === 'SL') trade.actualR = trade.isBE ? 0 : -1;
  else trade.actualR = 0;

  trade.result = result;
  trade.closedAt = new Date().toISOString();

  if (result === 'SL') {
    const cycle = cycleById(trade.cycleId);
    if (cycle && cycle.day === todayISO()) cycle.stopDay = true;
  }

  recomputeLadder();
  saveNow();
  closeModal();
  render();
  toast(result === 'SL' ? 'SL · STOP DAY' : result === 'TP' ? 'TP · сделка закрыта' : 'BE · 0R');
}

function moveToBE(trade) {
  if (!trade || trade.isBE) return;
  trade.currentStop = trade.entry;
  trade.isBE = true;
  saveNow();
  render();
  toast('SL переведён в BE');
}

function addLevel() {
  const cycle = draftCycle();
  if (!cycle) return;
  const price = num(levelDraft.price);
  if (price == null) {
    toast('Укажите цену уровня');
    return;
  }
  cycle.levels.push({
    id: uid(),
    type: levelDraft.type,
    price: price,
    note: levelDraft.note || '',
    absorbed: false
  });
  levelDraft = { type: levelDraft.type, price: '', note: '' };
  saveNow();
  render();
  toast('Уровень добавлен');
}

function exportJSON() {
  recomputeLadder();
  const payload = {
    app: 'ICT Checklist',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: db.settings,
    cycles: db.cycles,
    trades: db.trades,
    goals: db.goals
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ict-checklist-' + todayISO() + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
  toast('Копия скачана');
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', function () {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = normalizeDB(parsed);
        db = next;
        recomputeLadder();
        saveNow();
        render();
        toast('Копия восстановлена');
      } catch (err) {
        toast('Не удалось прочитать файл');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function resetAll() {
  openModal(
    '<div class="modal"><h2>Очистить всё?</h2>' +
    '<div class="sub">Циклы, сделки, уровни, цели и настройки будут удалены из этого браузера.</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" data-act="close-modal">Отмена</button>' +
    '<button class="btn btn-danger" data-act="do-reset">Удалить</button></div></div>'
  );
}

/* =========================================================
   19. События
   ========================================================= */

document.addEventListener('click', function (event) {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.getAttribute('data-act');
  const cycle = draftCycle();

  if (act === 'nav') {
    ui.view = target.getAttribute('data-view');
    ui.selectedDay = null;
    closeModal();
    render();
    return;
  }

  if (act === 'start-cycle') {
    startCycle();
    return;
  }

  if (act === 'step-next') {
    actNextStep();
    return;
  }

  if (act === 'step-prev') {
    actPrevStep();
    return;
  }

  if (act === 'step-jump') {
    if (!cycle) return;
    cycle.step = Number(target.getAttribute('data-index'));
    saveNow();
    render();
    return;
  }

  if (act === 'toggle-news') {
    if (!cycle) return;
    const code = target.getAttribute('data-code');
    cycle.news[code] = !cycle.news[code];
    saveNow();
    render();
    return;
  }

  if (act === 'set-direction') {
    if (!cycle) return;
    cycle.direction = target.getAttribute('data-value');
    saveNow();
    render();
    return;
  }

  if (act === 'set-trend') {
    if (!cycle) return;
    cycle.trend = target.getAttribute('data-value');
    saveNow();
    render();
    return;
  }

  if (act === 'set-symbol') {
    if (!cycle) return;
    cycle.symbol = target.getAttribute('data-value');
    saveNow();
    render();
    return;
  }

  if (act === 'toggle-a') {
    if (!cycle) return;
    const field = target.getAttribute('data-field');
    cycle.a[field] = !cycle.a[field];
    saveNow();
    render();
    return;
  }

  if (act === 'toggle-a-valid') {
    if (!cycle) return;
    cycle.a.valid = cycle.a.valid === false;
    saveNow();
    render();
    return;
  }

  if (act === 'toggle-b-valid') {
    if (!cycle) return;
    cycle.b.valid = cycle.b.valid === false;
    saveNow();
    render();
    return;
  }

  if (act === 'toggle-confirmation') {
    if (!cycle) return;
    const key = target.getAttribute('data-key');
    cycle.confirmations[key] = !cycle.confirmations[key];
    saveNow();
    render();
    return;
  }

  if (act === 'add-level') {
    addLevel();
    return;
  }

  if (act === 'toggle-level') {
    if (!cycle) return;
    const level = cycle.levels.find(function (item) {
      return item.id === target.getAttribute('data-id');
    });
    if (level) level.absorbed = !level.absorbed;
    saveNow();
    render();
    return;
  }

  if (act === 'remove-level') {
    if (!cycle) return;
    cycle.levels = cycle.levels.filter(function (item) {
      return item.id !== target.getAttribute('data-id');
    });
    saveNow();
    render();
    return;
  }

  if (act === 'close-trade') {
    const trade = tradeById(target.getAttribute('data-id'));
    if (trade) closeTradeModal(trade);
    return;
  }

  if (act === 'do-close') {
    const trade = tradeById(target.getAttribute('data-id'));
    closeTrade(trade, target.getAttribute('data-result'));
    return;
  }

  if (act === 'move-be') {
    moveToBE(tradeById(target.getAttribute('data-id')));
    return;
  }

  if (act === 'trade-note') {
    const trade = tradeById(target.getAttribute('data-id'));
    if (trade) tradeNoteModal(trade);
    return;
  }

  if (act === 'save-trade-note') {
    const trade = tradeById(target.getAttribute('data-id'));
    if (trade) {
      const tagsInput = document.getElementById('trade-tags');
      const noteInput = document.getElementById('trade-note');
      trade.tags = (tagsInput ? tagsInput.value : '')
        .split(',')
        .map(function (tag) {
          return tag.trim();
        })
        .filter(Boolean);
      trade.note = noteInput ? noteInput.value : '';
      saveNow();
    }
    closeModal();
    render();
    toast('Сохранено');
    return;
  }

  if (act === 'trade-filter') {
    ui.tradeFilter = target.getAttribute('data-value');
    render();
    return;
  }

  if (act === 'new-trade') {
    newTradeModal();
    return;
  }

  if (act === 'save-new-trade') {
    const entry = num(document.getElementById('nt-entry').value);
    const sl = num(document.getElementById('nt-sl').value);
    const tp = num(document.getElementById('nt-tp').value);
    const risk = num(document.getElementById('nt-risk').value);
    if (entry == null || sl == null || tp == null) {
      toast('Заполните entry, SL и TP');
      return;
    }
    const plannedRR = Math.abs(tp - entry) / Math.abs(entry - sl);
    db.trades.push({
      id: uid(),
      cycleId: null,
      tradeDay: todayISO(),
      entryDate: new Date().toISOString(),
      symbol: document.getElementById('nt-symbol').value,
      direction: document.getElementById('nt-direction').value,
      ladderStep: db.ladder.step,
      riskUSD: risk == null ? ladderAmount(db.ladder.step) : risk,
      entry: entry,
      originalStop: sl,
      currentStop: sl,
      tp: tp,
      plannedRR: plannedRR,
      result: 'open',
      actualR: 0,
      isBE: false,
      tags: [],
      note: document.getElementById('nt-note').value,
      closedAt: null
    });
    recomputeLadder();
    saveNow();
    closeModal();
    render();
    toast('Сделка добавлена');
    return;
  }

  if (act === 'set-period') {
    ui.period = target.getAttribute('data-value');
    render();
    return;
  }

  if (act === 'month-prev') {
    ui.calendarMonth = addMonthsISO(ui.calendarMonth, -1);
    ui.selectedDay = null;
    render();
    return;
  }

  if (act === 'month-next') {
    ui.calendarMonth = addMonthsISO(ui.calendarMonth, 1);
    ui.selectedDay = null;
    render();
    return;
  }

  if (act === 'open-day') {
    ui.selectedDay = target.getAttribute('data-day');
    render();
    return;
  }

  if (act === 'save-goal') {
    const input = document.querySelector('[data-kind="goal"]');
    const value = Math.max(1, Math.round(num(input ? input.value : 10) || 10));
    db.goals[monthKey(todayISO())] = value;
    saveNow();
    render();
    toast('Цель сохранена');
    return;
  }

  if (act === 'level-type') {
    ui.levelType = target.getAttribute('data-value');
    render();
    return;
  }

  if (act === 'toggle-active') {
    ui.onlyActive = !ui.onlyActive;
    render();
    return;
  }

  if (act === 'open-cycle') {
    const cycleToShow = cycleById(target.getAttribute('data-id'));
    if (cycleToShow) openModal(cycleModalHTML(cycleToShow));
    return;
  }

  if (act === 'add-symbol') {
    const input = document.getElementById('new-symbol');
    const value = (input ? input.value : '').trim().toUpperCase();
    if (!value) return;
    if (db.settings.symbols.indexOf(value) === -1) {
      db.settings.symbols.push(value);
      saveNow();
      render();
      toast('Символ добавлен');
    }
    return;
  }

  if (act === 'remove-symbol') {
    const value = target.getAttribute('data-value');
    if (db.settings.symbols.length <= 1) {
      toast('Нужен хотя бы один символ');
      return;
    }
    db.settings.symbols = db.settings.symbols.filter(function (symbol) {
      return symbol !== value;
    });
    saveNow();
    render();
    return;
  }

  if (act === 'toggle-limits') {
    db.settings.limits.enabled = !db.settings.limits.enabled;
    saveNow();
    render();
    return;
  }

  if (act === 'export') {
    exportJSON();
    return;
  }

  if (act === 'import') {
    importJSON();
    return;
  }

  if (act === 'reset') {
    resetAll();
    return;
  }

  if (act === 'demo') {
    fillDemoData();
    return;
  }

  if (act === 'do-reset') {
    db = defaultDB();
    recomputeLadder();
    saveNow();
    closeModal();
    render();
    toast('Данные очищены · демо можно вернуть в «Настройках»');
    return;
  }

  if (act === 'close-modal' || act === 'overlay') {
    if (act === 'overlay' && event.target !== target) return;
    closeModal();
    return;
  }
});

document.addEventListener('input', function (event) {
  const field = event.target;
  if (field.hasAttribute('data-act') && field.getAttribute('data-act') === 'trade-search') {
    ui.search = field.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      searchFocus = true;
      render();
    }, 220);
    return;
  }

  const path = field.getAttribute('data-bind');
  if (!path) return;
  const kind = field.getAttribute('data-kind') || 'auto';

  if (path === '__levelType' || path === '__levelPrice' || path === '__levelNote') {
    if (path === '__levelType') levelDraft.type = field.value;
    if (path === '__levelPrice') levelDraft.price = field.value;
    if (path === '__levelNote') levelDraft.note = field.value;
    return;
  }

  if (path === '__goal') {
    return;
  }

  let value;
  if (kind === 'text' || field.type === 'text' || field.type === 'time' || field.tagName === 'TEXTAREA') {
    value = field.value;
  } else if (field.type === 'number') {
    value = num(field.value);
  } else {
    value = field.value;
  }

  if (path.indexOf('settings.') === 0) {
    if (value === null) return;
    setPath(db.settings, path.slice('settings.'.length), value);
    save();
    return;
  }

  const cycle = draftCycle();
  if (cycle) {
    setPath(cycle, path, value);
    save();
  }
});

document.addEventListener('change', function (event) {
  const field = event.target;
  if (!field.hasAttribute('data-bind')) return;
  const path = field.getAttribute('data-bind');
  if (path === '__goal') return;
  if (path === '__levelType' || path === '__levelPrice' || path === '__levelNote') {
    if (path === '__levelType') levelDraft.type = field.value;
    if (path === '__levelPrice') levelDraft.price = field.value;
    if (path === '__levelNote') levelDraft.note = field.value;
    return;
  }
  saveNow();
  render();
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') closeModal();
});

/* =========================================================
   20. Запуск
   ========================================================= */

function afterRenderFocus() {
  if (!searchFocus) return;
  const field = document.querySelector('[data-act="trade-search"]');
  if (field) {
    field.focus();
    const length = field.value.length;
    try {
      field.setSelectionRange(length, length);
    } catch (err) {
      /* noop */
    }
  }
  searchFocus = false;
}

const originalRender = render;
render = function () {
  originalRender();
  afterRenderFocus();
};

function seedDemoOnce() {
  try {
    if (localStorage.getItem('ict-demo-seeded')) return;
    if (db.cycles.length || db.trades.length) return;
    localStorage.setItem('ict-demo-seeded', '1');
  } catch (err) {
    return;
  }
  fillDemoData();
}

recomputeLadder();
seedDemoOnce();
save();
render();


/* =========================================================
   21. Демонстрационные данные
   ========================================================= */

function fillDemoData() {
  const symbols = db.settings.symbols.length ? db.settings.symbols : ['EURUSD'];
  const basePrice = { EURUSD: 1.082, GBPUSD: 1.268, XAUUSD: 2345 };

  const results = ['TP', 'TP', 'TP', 'SL', 'SL', 'BE'];

  for (let back = 56; back >= 1; back -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - back);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    if (back !== 2 && back !== 4 && Math.random() > 0.55) continue;

    const iso = isoDate(date);
    if (cycleOfDay(iso)) continue;

    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const base = basePrice[symbol] || 1.1;
    const entry = round(base + (Math.random() - 0.5) * 0.02, 5);
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const sl = round(entry + (direction === 'LONG' ? -1 : 1) * 0.0022, 5);
    const tp = round(entry + (direction === 'LONG' ? 1 : -1) * 0.0044, 5);
    const step = Math.floor(Math.random() * 3);
    const risk = Number(db.settings.ladder[step]);
    const plannedRR = round(Math.abs(tp - entry) / Math.abs(entry - sl), 2);
    const result = results[Math.floor(Math.random() * results.length)];
    const actualR = result === 'TP' ? plannedRR : result === 'SL' ? -1 : 0;

    const cycleId = uid();
    const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 30, 0).toISOString();
    const closeDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 21, 10, 0).toISOString();

    db.cycles.push({
      id: cycleId,
      day: iso,
      createdAt: date.getTime(),
      step: 18,
      news: { eur: Math.random() > 0.7, gbp: false, usd: Math.random() > 0.5, note: '' },
      direction: direction,
      trend: Math.random() > 0.25 ? 'OF' : 'SOF',
      trendNote: '',
      drHigh: round(base + 0.006, 5),
      drLow: round(base - 0.006, 5),
      price: entry,
      levels: [
        { id: uid(), type: 'SNR', price: round(base + 0.003, 5), note: '', absorbed: Math.random() > 0.6 },
        { id: uid(), type: 'FVG', price: round(base - 0.002, 5), note: '', absorbed: Math.random() > 0.6 }
      ],
      a: { snr: true, of: true, fractal: true, price: sl, depth: 0.3, note: '', valid: true },
      b: { price: tp, type: 'Fractal', note: '', valid: true },
      confirmations: { testA: true, reaction: true, slowdown: true, fractals: true, snr: true, test: true },
      entry: { entry: entry, sl: sl, tp: tp },
      risk: { step: step, usd: risk, accR: 0 },
      stopDay: result === 'SL',
      result: result === 'SL' ? 'stopped' : 'entry',
      tradeId: uid(),
      symbol: symbol
    });

    const tradeId = db.cycles[db.cycles.length - 1].tradeId;

    db.trades.push({
      id: tradeId,
      cycleId: cycleId,
      tradeDay: iso,
      entryDate: entryDate,
      symbol: symbol,
      direction: direction,
      ladderStep: step,
      riskUSD: risk,
      entry: entry,
      originalStop: sl,
      currentStop: sl,
      tp: tp,
      plannedRR: plannedRR,
      result: result,
      actualR: actualR,
      isBE: result === 'BE',
      tags: Math.random() > 0.7 ? ['A+ setup'] : [],
      note: '',
      closedAt: closeDate
    });
  }

  const currentKey = monthKey(todayISO());
  const previousKey = monthKey(addMonthsISO(firstOfMonthISO(new Date()), -1));
  [currentKey, previousKey].forEach(function (key) {
    if (!db.goals[key]) db.goals[key] = 10;
  });

  recomputeLadder();
  saveNow();
  render();
  toast('Демо-данные добавлены');
}
