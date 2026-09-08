const EARNINGS_CACHE_KEY = 'alphaVantageEarnings';
const EARNINGS_CACHE_DAY_KEY = 'alphaVantageEarningsDay';
const EARNINGS_ATTEMPT_KEY = 'alphaVantageEarningsAttempt';
const EARNINGS_RETRY_MS = 6 * 60 * 60 * 1000;
const EARNINGS_ESTIMATE_CACHE_KEY = 'alphaVantageEarningsEstimates';
const EPS_OUTLOOK_PREFIX = 'alphaVantageEpsOutlook.';
const EPS_OUTLOOK_CURSOR_KEY = 'alphaVantageEpsCursor';
const EPS_OUTLOOK_DAY_KEY = 'alphaVantageEpsDay';
const EPS_OUTLOOK_COUNT_KEY = 'alphaVantageEpsCount';
const EPS_OUTLOOK_MAX_DAILY = 20;
const EPS_OUTLOOK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function refreshEarningsCalendar_(props, force) {
  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  if (props.getProperty(EARNINGS_CACHE_DAY_KEY) === today) {
    refreshEpsOutlook_(props, force);
    return;
  }

  const apiKey = props.getProperty('ALPHA_VANTAGE_API_KEY');
  if (!apiKey) return;

  const now = Date.now();
  const lastAttempt = Number(props.getProperty(EARNINGS_ATTEMPT_KEY) || 0);
  if (!force && now - lastAttempt < EARNINGS_RETRY_MS) return;
  props.setProperty(EARNINGS_ATTEMPT_KEY, String(now));

  const url = 'https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Alpha Vantage earnings request failed with HTTP ' + response.getResponseCode());

  const csv = response.getContentText();
  const details = parseEarningsCalendarDetails_(csv, SYMBOLS, today);
  const dates = {};
  Object.keys(details).forEach(symbol => { dates[symbol] = details[symbol].reportDate; });
  if (!Object.keys(dates).length && csv.indexOf('symbol,') !== 0) throw new Error('Alpha Vantage did not return an earnings calendar');

  props.setProperty(EARNINGS_CACHE_KEY, JSON.stringify(dates));
  props.setProperty(EARNINGS_ESTIMATE_CACHE_KEY, JSON.stringify(details));
  props.setProperty(EARNINGS_CACHE_DAY_KEY, today);
  refreshEpsOutlook_(props, force);
}

function parseEarningsCalendar_(csv, symbols, today) {
  const details = parseEarningsCalendarDetails_(csv, symbols, today);
  const dates = {};
  Object.keys(details).forEach(symbol => { dates[symbol] = details[symbol].reportDate; });
  return dates;
}

function parseEarningsCalendarDetails_(csv, symbols, today) {
  const rows = Utilities.parseCsv(csv || '');
  if (rows.length < 2) return {};
  const headers = rows[0].map(value => String(value).trim());
  const symbolIndex = headers.indexOf('symbol');
  const dateIndex = headers.indexOf('reportDate');
  const fiscalIndex = headers.indexOf('fiscalDateEnding');
  const estimateIndex = headers.indexOf('estimate');
  if (symbolIndex < 0 || dateIndex < 0) return {};

  const universe = new Set(symbols.map(symbol => String(symbol).toUpperCase()));
  const details = {};
  rows.slice(1).forEach(row => {
    const symbol = String(row[symbolIndex] || '').trim().toUpperCase();
    const date = String(row[dateIndex] || '').trim();
    if (!universe.has(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return;
    if (!details[symbol] || date < details[symbol].reportDate) {
      details[symbol] = {
        reportDate: date,
        fiscalDateEnding: fiscalIndex >= 0 ? String(row[fiscalIndex] || '').trim() : '',
        estimate: estimateIndex >= 0 ? numberOrNull_(row[estimateIndex]) : null
      };
    }
  });
  return details;
}

function numberOrNull_(value) {
  const number = Number(value);
  return value !== '' && isFinite(number) ? number : null;
}

function getEarningsEstimateDetails_(props) {
  try {
    const value = JSON.parse(props.getProperty(EARNINGS_ESTIMATE_CACHE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (err) {
    return {};
  }
}

function calculateEpsOutlook_(estimate, priorActual) {
  estimate = numberOrNull_(estimate);
  priorActual = numberOrNull_(priorActual);
  if (estimate === null || priorActual === null) return null;

  if (priorActual <= 0) {
    if (estimate > 0) return { growthPct: null, label: 'Turnaround' };
    if (estimate > priorActual) return { growthPct: null, label: 'Improving' };
    if (estimate < priorActual) return { growthPct: null, label: 'Contracting' };
    return { growthPct: null, label: 'Stable' };
  }

  const growthPct = Math.round(((estimate - priorActual) / Math.abs(priorActual)) * 1000) / 10;
  return {
    growthPct: growthPct,
    label: growthPct > 5 ? 'Growing' : growthPct < -5 ? 'Contracting' : 'Stable'
  };
}

function findComparableQuarter_(quarterlyEarnings, fiscalDateEnding) {
  const target = new Date(fiscalDateEnding + 'T00:00:00Z').getTime();
  if (!isFinite(target)) return null;
  let best = null;
  (quarterlyEarnings || []).forEach(item => {
    const date = String(item.fiscalDateEnding || '');
    const time = new Date(date + 'T00:00:00Z').getTime();
    const days = (target - time) / 86400000;
    const actual = numberOrNull_(item.reportedEPS);
    if (!isFinite(time) || actual === null || days < 300 || days > 430) return;
    const distance = Math.abs(days - 365);
    if (!best || distance < best.distance) best = { actual: actual, date: date, distance: distance };
  });
  return best;
}

function buildEpsOutlook_(payload, upcoming) {
  if (!upcoming || upcoming.estimate === null || !/^\d{4}-\d{2}-\d{2}$/.test(upcoming.fiscalDateEnding || '')) return null;
  const comparable = findComparableQuarter_(payload && payload.quarterlyEarnings, upcoming.fiscalDateEnding);
  if (!comparable) return null;
  const result = calculateEpsOutlook_(upcoming.estimate, comparable.actual);
  if (!result) return null;
  return Object.assign(result, {
    estimate: upcoming.estimate,
    priorActual: comparable.actual,
    fiscalDateEnding: upcoming.fiscalDateEnding,
    comparisonFiscalDate: comparable.date,
    updatedAt: new Date().toISOString()
  });
}

function refreshEpsOutlook_(props, force) {
  const apiKey = props.getProperty('ALPHA_VANTAGE_API_KEY');
  if (!apiKey) return;
  const upcoming = getEarningsEstimateDetails_(props);
  const candidates = SYMBOLS.filter(symbol => upcoming[symbol] && upcoming[symbol].estimate !== null);
  if (!candidates.length) return;

  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  if (props.getProperty(EPS_OUTLOOK_DAY_KEY) !== today) {
    props.setProperty(EPS_OUTLOOK_DAY_KEY, today);
    props.setProperty(EPS_OUTLOOK_COUNT_KEY, '0');
  }
  const count = Number(props.getProperty(EPS_OUTLOOK_COUNT_KEY) || 0);
  if (!force && count >= EPS_OUTLOOK_MAX_DAILY) return;

  const start = Number(props.getProperty(EPS_OUTLOOK_CURSOR_KEY) || 0) % candidates.length;
  let selected = null;
  let selectedIndex = start;
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const index = (start + offset) % candidates.length;
    const symbol = candidates[index];
    let cached = null;
    try { cached = JSON.parse(props.getProperty(EPS_OUTLOOK_PREFIX + symbol) || 'null'); } catch (err) {}
    const age = cached && cached.updatedAt ? Date.now() - new Date(cached.updatedAt).getTime() : Infinity;
    if (force || !cached || cached.fiscalDateEnding !== upcoming[symbol].fiscalDateEnding || !isFinite(age) || age > EPS_OUTLOOK_MAX_AGE_MS) {
      selected = symbol;
      selectedIndex = index;
      break;
    }
  }
  if (!selected) return;

  const url = 'https://www.alphavantage.co/query?function=EARNINGS&symbol=' + encodeURIComponent(selected) + '&apikey=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  props.setProperty(EPS_OUTLOOK_COUNT_KEY, String(count + 1));
  props.setProperty(EPS_OUTLOOK_CURSOR_KEY, String((selectedIndex + 1) % candidates.length));
  if (response.getResponseCode() !== 200) return;

  let payload;
  try { payload = JSON.parse(response.getContentText()); } catch (err) { return; }
  if (!payload || !Array.isArray(payload.quarterlyEarnings)) return;
  const outlook = buildEpsOutlook_(payload, upcoming[selected]);
  if (outlook) props.setProperty(EPS_OUTLOOK_PREFIX + selected, JSON.stringify(outlook));
}

function getEpsOutlook_(props, symbol) {
  try {
    const value = JSON.parse(props.getProperty(EPS_OUTLOOK_PREFIX + symbol) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch (err) {
    return null;
  }
}

function getEarningsDates_(props) {
  try {
    const value = JSON.parse(props.getProperty(EARNINGS_CACHE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (err) {
    return {};
  }
}

function addEarningsDates_(rows, props) {
  const dates = getEarningsDates_(props);
  return rows.map(row => Object.assign({}, row, {
    earningsDate: dates[row.symbol] || null,
    epsOutlook: getEpsOutlook_(props, row.symbol)
  }));
}

function refreshEarningsCalendar() {
  refreshEarningsCalendar_(PropertiesService.getScriptProperties(), true);
}
