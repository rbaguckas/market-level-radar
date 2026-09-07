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
let fetches = 0;
const context = vm.createContext({
  SYMBOLS: ["AAPL", "MSFT", "NVDA"],
  Utilities: { parseCsv, formatDate: () => "2026-09-07" },
  UrlFetchApp: { fetch: () => { fetches += 1; return { getResponseCode: () => 200, getContentText: () => csv }; } },
  Set, Object, Array, JSON, Date, Error
});
vm.runInContext(source + ";globalThis.api={parseEarningsCalendar_,refreshEarningsCalendar_,addEarningsDates_};", context);

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
assert.equal(fetches, 1);
assert.equal(values.get("alphaVantageEarningsDay"), "2026-09-07");

const enriched = context.api.addEarningsDates_([{symbol:"AAPL"},{symbol:"MSFT"},{symbol:"NVDA"}], props);
assert.deepEqual(enriched.map(row => row.earningsDate), ["2026-09-09", "2026-09-08", null]);
console.log("PASS: bulk calendar parsing, universe mapping, earliest upcoming date, daily cache and response enrichment.");
