const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "src/index.js"), "utf8")
  .replace("export class UserState", "class UserState")
  .replace("export default {", "const worker = {");
const context = vm.createContext({ Object, Array, Set, String, Date, JSON, Response, TextEncoder, URL, crypto });
vm.runInContext(source + ";globalThis.cleanSharedStateForTest=cleanSharedState;", context);

const cleaned = context.cleanSharedStateForTest({
  interested: ["AAPL", "BTC/USD"],
  notes: { AAPL: "Flagged note", "BTC/USD": "Crypto note", MSFT: "Keep after unflag", "invalid symbol": "Ignore" }
});

assert.deepEqual([...cleaned.interested], ["AAPL", "BTC/USD"]);
assert.deepEqual({ ...cleaned.notes }, { AAPL: "Flagged note", "BTC/USD": "Crypto note", MSFT: "Keep after unflag" });
console.log("PASS: notes remain saved independently of Interested flags.");
