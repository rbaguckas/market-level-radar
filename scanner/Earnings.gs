const EARNINGS_CACHE_KEY = 'alphaVantageEarnings';
const EARNINGS_CACHE_DAY_KEY = 'alphaVantageEarningsDay';
const EARNINGS_ATTEMPT_KEY = 'alphaVantageEarningsAttempt';
const EARNINGS_RETRY_MS = 6 * 60 * 60 * 1000;

function refreshEarningsCalendar_(props, force) {
  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  if (props.getProperty(EARNINGS_CACHE_DAY_KEY) === today) return;

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
  const dates = parseEarningsCalendar_(csv, SYMBOLS, today);
  if (!Object.keys(dates).length && csv.indexOf('symbol,') !== 0) throw new Error('Alpha Vantage did not return an earnings calendar');

  props.setProperty(EARNINGS_CACHE_KEY, JSON.stringify(dates));
  props.setProperty(EARNINGS_CACHE_DAY_KEY, today);
}

function parseEarningsCalendar_(csv, symbols, today) {
  const rows = Utilities.parseCsv(csv || '');
  if (rows.length < 2) return {};
  const headers = rows[0].map(value => String(value).trim());
  const symbolIndex = headers.indexOf('symbol');
  const dateIndex = headers.indexOf('reportDate');
  if (symbolIndex < 0 || dateIndex < 0) return {};

  const universe = new Set(symbols.map(symbol => String(symbol).toUpperCase()));
  const dates = {};
  rows.slice(1).forEach(row => {
    const symbol = String(row[symbolIndex] || '').trim().toUpperCase();
    const date = String(row[dateIndex] || '').trim();
    if (!universe.has(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return;
    if (!dates[symbol] || date < dates[symbol]) dates[symbol] = date;
  });
  return dates;
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
  return rows.map(row => Object.assign({}, row, { earningsDate: dates[row.symbol] || null }));
}

function refreshEarningsCalendar() {
  refreshEarningsCalendar_(PropertiesService.getScriptProperties(), true);
}
