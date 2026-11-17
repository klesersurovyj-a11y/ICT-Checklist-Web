const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('ICT Checklist Web/app.js', 'utf8');

const store = {};
const localStorage = {
  getItem: function (key) {
    return key in store ? store[key] : null;
  },
  setItem: function (key, value) {
    store[key] = String(value);
  },
  removeItem: function (key) {
    delete store[key];
  }
};

const elements = {};
function makeEl() {
  return {
    innerHTML: '',
    value: '',
    style: {},
    textContent: '',
    files: [],
    classList: { add: function () {}, remove: function () {} },
    focus: function () {},
    setSelectionRange: function () {},
    appendChild: function () {},
    removeChild: function () {},
    click: function () {},
    setAttribute: function () {},
    getAttribute: function () {
      return null;
    },
    hasAttribute: function () {
      return false;
    }
  };
}

const documentStub = {
  getElementById: function (id) {
    if (!elements[id]) elements[id] = makeEl();
    return elements[id];
  },
  querySelector: function () {
    return null;
  },
  querySelectorAll: function () {
    return [];
  },
  addEventListener: function () {},
  createElement: function () {
    return makeEl();
  },
  body: { appendChild: function () {}, removeChild: function () {} }
};

const sandbox = {
  localStorage: localStorage,
  document: documentStub,
  window: { scrollTo: function () {} },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  requestAnimationFrame: function (fn) {
    return fn();
  },
  Blob: function () {},
  URL: { createObjectURL: function () { return 'blob:'; }, revokeObjectURL: function () {} },
  FileReader: function () {},
  Math: Math,
  Date: Date,
  JSON: JSON,
  Number: Number,
  String: String,
  Object: Object,
  Array: Array,
  Intl: Intl,
  isNaN: isNaN,
  parseFloat: parseFloat,
  RegExp: RegExp,
  Error: Error
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(
  code +
    '\n;globalThis.__api = {' +
    ' getDb: function () { return db; },' +
    ' setDb: function (v) { db = v; },' +
    ' startCycle: startCycle,' +
    ' next: actNextStep,' +
    ' draft: draftCycle,' +
    ' hint: blockingHint,' +
    ' openTrade: openTradeFromCycle,' +
    ' closeTrade: closeTrade,' +
    ' renderAll: function (v) { ui.view = v; render(); return document.getElementById("app").innerHTML.length; }' +
    '};',
  sandbox
);

const api = sandbox.__api;
const results = [];
function check(name, condition, extra) {
  results.push((condition ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
}

// Пустая база
api.setDb({
  version: 1,
  settings: {
    symbols: ['EURUSD', 'GBPUSD'],
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
});

api.renderAll('today');
api.startCycle();
let cycle = api.draft();
check('start cycle', Boolean(cycle), cycle && cycle.day);

const keys = ['news', 'risk', 'ofsof', 'trendW1', 'lastDR', 'premiumDiscount', 'keyLevels', 'keyLevelToPointA', 'pointA', 'pointB', 'testA', 'reaction', 'slowdown', 'fractals', 'snr', 'test', 'rr', 'symbol'];

check('step 1 hint empty', api.hint(cycle) === null, api.hint(cycle));
api.next();

api.next(); // risk
api.next(); // ofsof
api.next(); // trendW1

check('dr hint before fill', api.hint(cycle) !== null, api.hint(cycle));
cycle.drHigh = 1.09;
cycle.drLow = 1.08;
cycle.price = 1.082;
api.next(); // lastDR -> p/d
api.next(); // p/d -> key levels

check('key levels hint', api.hint(cycle) !== null);
cycle.levels.push({ id: 'l1', type: 'SNR', price: 1.085, note: '', absorbed: false });
api.next(); // key levels -> keyLevelToPointA

check('conditions hint', api.hint(cycle) !== null);
cycle.a.snr = true;
cycle.a.of = true;
cycle.a.fractal = true;
api.next(); // -> pointA

cycle.a.price = 1.081;
api.next(); // -> pointB
cycle.b.price = 1.089;
api.next(); // -> testA

['testA', 'reaction', 'slowdown', 'fractals', 'snr', 'test'].forEach(function (key) {
  check('hint on ' + key, api.hint(cycle) !== null);
  cycle.confirmations[key] = true;
  api.next();
});

check('rr step hint', api.hint(cycle) !== null, api.hint(cycle));
cycle.entry.entry = 1.083;
cycle.entry.sl = 1.081;
cycle.entry.tp = 1.089;
check('rr hint gone', api.hint(cycle) === null, api.hint(cycle));
api.next(); // rr -> symbol
api.next(); // symbol -> entry

check('entry hint', api.hint(cycle) === null, api.hint(cycle));
api.next(); // открыть сделку

const db = api.getDb();
check('trade opened', db.trades.length === 1, 'trades=' + db.trades.length);
check('cycle entry', cycle.result === 'entry', cycle.result);
check('trade open result', db.trades[0].result === 'open');

api.renderAll('trades');
api.closeTrade(db.trades[0], 'TP');
check('trade closed TP', db.trades[0].result === 'TP', db.trades[0].result);
check('actualR = plannedRR', Math.abs(db.trades[0].actualR - db.trades[0].plannedRR) < 1e-9 + 0, db.trades[0].actualR);

api.setDb({
  version: 1,
  settings: {
    symbols: ['EURUSD'],
    minRR: 2,
    ladder: [12, 25, 50],
    cycleStart: '19:00',
    cycleEnd: '22:00',
    limits: { enabled: true, maxLossR: 2, maxTrades: 1 }
  },
  cycles: [],
  trades: [],
  ladder: { step: 0, accR: 0 },
  goals: {}
});
api.startCycle();
const limitCycle = api.draft();
limitCycle.drHigh = 1.09;
limitCycle.drLow = 1.08;
limitCycle.price = 1.082;
limitCycle.levels.push({ id: 'l1', type: 'SNR', price: 1.085, note: '', absorbed: false });
limitCycle.a.snr = true;
limitCycle.a.of = true;
limitCycle.a.fractal = true;
limitCycle.a.price = 1.081;
limitCycle.b.price = 1.089;
limitCycle.confirmations = { testA: true, reaction: true, slowdown: true, fractals: true, snr: true, test: true };
limitCycle.entry.entry = 1.083;
limitCycle.entry.sl = 1.081;
limitCycle.entry.tp = 1.089;
limitCycle.step = 18;

const fakeDb = api.getDb();
fakeDb.trades.push({
  id: 't1',
  cycleId: null,
  tradeDay: limitCycle.day,
  entryDate: new Date().toISOString(),
  symbol: 'EURUSD',
  direction: 'LONG',
  ladderStep: 0,
  riskUSD: 12,
  entry: 1.083,
  originalStop: 1.081,
  currentStop: 1.081,
  tp: 1.089,
  plannedRR: 3,
  result: 'open',
  actualR: 0,
  isBE: false,
  tags: [],
  note: '',
  closedAt: null
});

check('limits block entry', api.hint(limitCycle) !== null, api.hint(limitCycle));
api.openTrade(limitCycle);
check('limits keep trade count', api.getDb().trades.length === 1, 'trades=' + api.getDb().trades.length);

console.log(results.join('\n'));
console.log(results.filter(function (line) { return line.indexOf('FAIL') === 0; }).length === 0 ? 'ALL PASS' : 'HAS FAILURES');
