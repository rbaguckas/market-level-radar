const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname, "scanner/Earnings.gs"), "utf8");
const csv = [
  "symbol,name,reportDate,fiscalDateEnding,estimate,currency",
  "AAPL,Apple,2026-09-10,2026-06-30,1.2,USD",
  "MSFT,Microsoft,2026-09-08,2026-06-30,2.1,USD",
  "AAPL,Apple,2026-09-09,2026-06-30,1.2,USD",
  "NVDA,NVIDIA,2026-09-06,2026-06-30,0.9,USD",
  "OTHER,Other,2026-09-07,2026-06-30,0.1,USD"
].join("\n");

const parseCsv = text => text.split(/\r?\n/).filter(Boolean).map(line => line.split(","));
let calendarFetches = 0;
let epsFetches = 0;
const context = vm.createContext({
  SYMBOLS: ["AAPL", "MSFT", "NVDA"],
  Utilities: { parseCsv, formatDate: () => "2026-09-07" },
  UrlFetchApp: { fetch: url => {
    if (url.includes("EARNINGS_CALENDAR")) {
      calendarFetches += 1;
      return { getResponseCode: () => 200, getContentText: () => csv };
    }
    epsFetches += 1;
    const actual = url.includes("MSFT") ? "2.50" : "1.00";
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ quarterlyEarnings: [{ fiscalDateEnding: "2025-06-30", reportedEPS: actual }] })
    };
  } },
  Set, Object, Array, JSON, Date, Error, Math, Number, isFinite, encodeURIComponent
});
vm.runInContext(source + ";globalThis.api={parseEarningsCalendar_,parseEarningsCalendarDetails_,mergeEarningsEstimateDetails_,calculateEpsOutlook_,buildEpsOutlook_,refreshEarningsCalendar_,addEarningsDates_};", context);

const parsed = context.api.parseEarningsCalendar_(csv, context.SYMBOLS, "2026-09-07");
assert.deepEqual({...parsed}, { AAPL: "2026-09-09", MSFT: "2026-09-08" });

const values = new Map([["ALPHA_VANTAGE_API_KEY", "test-key"]]);
const props = {
  getProperty: key => values.get(key) ?? null,
  setProperty: (key, value) => values.set(key, value),
  setProperties: object => Object.entries(object).forEach(([key, value]) => values.set(key, value))
};
context.api.refreshEarningsCalendar_(props);
context.api.refreshEarningsCalendar_(props);
assert.equal(calendarFetches, 1);
assert.equal(epsFetches, 2);
assert.equal(values.get("alphaVantageEarningsDay"), "2026-09-07");

const legacyValues = new Map([
  ["ALPHA_VANTAGE_API_KEY", "test-key"],
  ["alphaVantageEarnings", JSON.stringify({ AAPL: "2026-09-09" })],
  ["alphaVantageEarningsDay", "2026-09-07"]
]);
const legacyProps = {
  getProperty: key => legacyValues.get(key) ?? null,
  setProperty: (key, value) => legacyValues.set(key, value),
  setProperties: object => Object.entries(object).forEach(([key, value]) => legacyValues.set(key, value))
};
const calendarFetchesBeforeMigration = calendarFetches;
context.api.refreshEarningsCalendar_(legacyProps);
assert.equal(calendarFetches, calendarFetchesBeforeMigration + 1);
assert.ok(legacyValues.has("alphaVantageEarningsEstimates"));
assert.ok(legacyValues.has("alphaVantageEpsOutlook.AAPL"));

const missingKeyValues = new Map();
context.api.refreshEarningsCalendar_({
  getProperty: key => missingKeyValues.get(key) ?? null,
  setProperty: (key, value) => missingKeyValues.set(key, value),
  setProperties: object => Object.entries(object).forEach(([key, value]) => missingKeyValues.set(key, value))
});
assert.equal(missingKeyValues.has("alphaVantageEarningsAttempt"), false);

assert.deepEqual(
  {...context.api.calculateEpsOutlook_(1.2, 1.0)},
  { growthPct: 20, label: "Growing" }
);
assert.deepEqual(
  {...context.api.calculateEpsOutlook_(2.1, 2.5)},
  { growthPct: -16, label: "Contracting" }
);
assert.equal(context.api.calculateEpsOutlook_(0.5, -0.2).label, "Turnaround");

const firstSeen = context.api.mergeEarningsEstimateDetails_({}, {
  AAPL: { reportDate: "2026-09-09", fiscalDateEnding: "2026-06-30", estimate: 1.2, estimateSourceDate: null }
}, "2026-09-07");
assert.equal(firstSeen.AAPL.estimateUpdatedAt, "2026-09-07");
assert.equal(firstSeen.AAPL.estimateUpdatedSource, "detected");
const unchanged = context.api.mergeEarningsEstimateDetails_(firstSeen, {
  AAPL: { reportDate: "2026-09-10", fiscalDateEnding: "2026-06-30", estimate: 1.2, estimateSourceDate: null }
}, "2026-09-08");
assert.equal(unchanged.AAPL.estimateUpdatedAt, "2026-09-07");
const changed = context.api.mergeEarningsEstimateDetails_(unchanged, {
  AAPL: { reportDate: "2026-09-10", fiscalDateEnding: "2026-06-30", estimate: 1.3, estimateSourceDate: null }
}, "2026-09-09");
assert.equal(changed.AAPL.estimateUpdatedAt, "2026-09-09");

const enriched = context.api.addEarningsDates_([{symbol:"AAPL"},{symbol:"MSFT"},{symbol:"NVDA"}], props);
assert.deepEqual(enriched.map(row => row.earningsDate), ["2026-09-09", "2026-09-08", null]);
assert.deepEqual(enriched.map(row => row.epsOutlook && row.epsOutlook.label), ["Growing", "Contracting", null]);
assert.deepEqual(enriched.slice(0, 2).map(row => row.epsOutlook.estimateUpdatedAt), ["2026-09-07", "2026-09-07"]);
console.log("PASS: earnings calendar, cached EPS outlook calculation and response enrichment.");
