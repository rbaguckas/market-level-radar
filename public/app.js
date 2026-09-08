(() => {
  const STORAGE = {
    scannerUrl: "mlr.scannerUrl",
    alertDistance: "mlr.alertDistance",
    interested: "mlr.interested",
    interestedNotes: "mlr.interestedNotes",
    sharedStateMigrated: "mlr.sharedStateMigrated.v1"
  };

  const STOCK_INFO = {
    "AAPL": ["Apple", "NASDAQ"], "ABBV": ["AbbVie", "NYSE"], "ABT": ["Abbott Laboratories", "NYSE"],
    "ADBE": ["Adobe", "NASDAQ"], "ADI": ["Analog Devices", "NASDAQ"], "ADP": ["Automatic Data Processing", "NASDAQ"],
    "AMAT": ["Applied Materials", "NASDAQ"], "AMD": ["Advanced Micro Devices", "NASDAQ"], "AMGN": ["Amgen", "NASDAQ"],
    "AMZN": ["Amazon", "NASDAQ"], "ANET": ["Arista Networks", "NYSE"], "APH": ["Amphenol", "NYSE"],
    "AVGO": ["Broadcom", "NASDAQ"], "AXP": ["American Express", "NYSE"], "BAC": ["Bank of America", "NYSE"],
    "BKNG": ["Booking Holdings", "NASDAQ"], "BLK": ["BlackRock", "NYSE"], "BMY": ["Bristol Myers Squibb", "NYSE"],
    "BRK.B": ["Berkshire Hathaway", "NYSE"], "BSX": ["Boston Scientific", "NYSE"], "C": ["Citigroup", "NYSE"],
    "CAT": ["Caterpillar", "NYSE"], "CB": ["Chubb", "NYSE"], "CL": ["Colgate-Palmolive", "NYSE"],
    "CME": ["CME Group", "NASDAQ"], "COP": ["ConocoPhillips", "NYSE"], "COST": ["Costco Wholesale", "NASDAQ"],
    "CRM": ["Salesforce", "NYSE"], "CSCO": ["Cisco Systems", "NASDAQ"], "CVX": ["Chevron", "NYSE"],
    "DE": ["Deere & Company", "NYSE"], "DHR": ["Danaher", "NYSE"], "DIS": ["Walt Disney", "NYSE"],
    "DUK": ["Duke Energy", "NYSE"], "ETN": ["Eaton", "NYSE"], "GD": ["General Dynamics", "NYSE"],
    "GE": ["GE Aerospace", "NYSE"], "GILD": ["Gilead Sciences", "NASDAQ"], "GOOGL": ["Alphabet", "NASDAQ"],
    "GS": ["Goldman Sachs", "NYSE"], "HD": ["Home Depot", "NYSE"], "HON": ["Honeywell", "NASDAQ"],
    "IBM": ["IBM", "NYSE"], "ICE": ["Intercontinental Exchange", "NYSE"], "INTU": ["Intuit", "NASDAQ"],
    "ISRG": ["Intuitive Surgical", "NASDAQ"], "JNJ": ["Johnson & Johnson", "NYSE"], "JPM": ["JPMorgan Chase", "NYSE"],
    "KKR": ["KKR & Co.", "NYSE"], "KO": ["Coca-Cola", "NYSE"], "LLY": ["Eli Lilly", "NYSE"],
    "LOW": ["Lowe's", "NYSE"], "LRCX": ["Lam Research", "NASDAQ"], "MA": ["Mastercard", "NYSE"],
    "MCD": ["McDonald's", "NYSE"], "MCO": ["Moody's", "NYSE"], "MDT": ["Medtronic", "NYSE"],
    "META": ["Meta Platforms", "NASDAQ"], "MMC": ["Marsh McLennan", "NYSE"], "MO": ["Altria Group", "NYSE"],
    "MRK": ["Merck", "NYSE"], "MSFT": ["Microsoft", "NASDAQ"], "MU": ["Micron Technology", "NASDAQ"],
    "NEE": ["NextEra Energy", "NYSE"], "NFLX": ["Netflix", "NASDAQ"], "NKE": ["Nike", "NYSE"],
    "NOW": ["ServiceNow", "NYSE"], "NVDA": ["NVIDIA", "NASDAQ"], "ORCL": ["Oracle", "NYSE"],
    "PANW": ["Palo Alto Networks", "NASDAQ"], "PEP": ["PepsiCo", "NASDAQ"], "PFE": ["Pfizer", "NYSE"],
    "PG": ["Procter & Gamble", "NYSE"], "PGR": ["Progressive", "NYSE"], "PH": ["Parker-Hannifin", "NYSE"],
    "PLD": ["Prologis", "NYSE"], "PM": ["Philip Morris International", "NYSE"], "QCOM": ["Qualcomm", "NASDAQ"],
    "RTX": ["RTX", "NYSE"], "SBUX": ["Starbucks", "NASDAQ"], "SCHW": ["Charles Schwab", "NYSE"],
    "SHW": ["Sherwin-Williams", "NYSE"], "SO": ["Southern Company", "NYSE"], "SPGI": ["S&P Global", "NYSE"],
    "SYK": ["Stryker", "NYSE"], "T": ["AT&T", "NYSE"], "TJX": ["TJX Companies", "NYSE"],
    "TMUS": ["T-Mobile US", "NASDAQ"], "TSLA": ["Tesla", "NASDAQ"], "TXN": ["Texas Instruments", "NASDAQ"],
    "UBER": ["Uber Technologies", "NYSE"], "UNP": ["Union Pacific", "NYSE"], "UPS": ["UPS", "NYSE"],
    "V": ["Visa", "NYSE"], "VRTX": ["Vertex Pharmaceuticals", "NASDAQ"], "VZ": ["Verizon", "NYSE"],
    "WFC": ["Wells Fargo", "NYSE"], "WM": ["Waste Management", "NYSE"], "WMT": ["Walmart", "NYSE"],
    "XOM": ["Exxon Mobil", "NYSE"]
  };

  const DEMO_ROWS = [
    {
      symbol: "NVDA", company: "NVIDIA · DEMO", market: "NASDAQ", zone: "FVG",
      candleFormation: "Bullish", price: 171.66, low: 169.80, high: 170.42, distance: 0.72, status: "Demo", demo: true,
      epsOutlook: { growthPct: 18.4, label: "Growing", estimate: 1.35, priorActual: 1.14 }
    },
    {
      symbol: "TSM", company: "TSMC · DEMO", market: "NYSE", zone: "FVG",
      candleFormation: "Bearish", price: 235.18, low: 232.40, high: 233.60, distance: 0.68, status: "Demo", demo: true,
      epsOutlook: { growthPct: -8.2, label: "Contracting", estimate: 1.12, priorActual: 1.22 }
    }
  ];

  let rows = [...DEMO_ROWS];
  let activeFilter = "all";
  let searchTerm = "";
  let scanProgress = { processed: 0, total: 100 };
  let feedConnected = false;
  let sharedInterested = new Set();
  let sharedNotes = {};
  let saveQueue = Promise.resolve();
  let saveRevision = 0;
  let noteSaveTimer = null;

  const $ = (id) => document.getElementById(id);
  const els = {
    body: $("radarBody"),
    empty: $("emptyState"),
    search: $("searchInput"),
    scannerUrl: $("scannerUrl"),
    connect: $("connectBtn"),
    refresh: $("refreshBtn"),
    settings: $("settingsBtn"),
    feedBadge: $("feedBadge"),
    connectPanel: $("connectPanel"),
    quarterLabel: $("quarterLabel"),
    reporting: $("reportingCount"),
    reportingTotal: $("reportingTotal"),
    scanProgressLabel: $("scanProgressLabel"),
    scanProgressBar: $("scanProgressBar"),
    lastScan: $("lastScan"),
    signalCount: $("signalCount"),
    fvgCount: $("fvgCount"),
    alertDistance: $("alertDistance"),
    saveSettings: $("saveSettingsBtn"),
    dialog: $("settingsDialog"),
    dialogScannerUrl: $("dialogScannerUrl"),
    dialogAlertDistance: $("dialogAlertDistance"),
    dialogSave: $("dialogSaveBtn"),
    disconnect: $("disconnectBtn"),
    syncStatus: $("syncStatus")
  };

  const state = {
    get scannerUrl() { return (localStorage.getItem(STORAGE.scannerUrl) || "").trim(); },
    set scannerUrl(v) { v ? localStorage.setItem(STORAGE.scannerUrl, v.trim()) : localStorage.removeItem(STORAGE.scannerUrl); },
    get alertDistance() {
      const saved = localStorage.getItem(STORAGE.alertDistance);
      if (saved === null || saved === "") return 1.0;
      const n = Number(saved);
      return Number.isFinite(n) && n >= 0 ? n : 1.0;
    },
    set alertDistance(v) { localStorage.setItem(STORAGE.alertDistance, String(v)); },
    get interested() {
      try { return new Set(JSON.parse(localStorage.getItem(STORAGE.interested) || "[]")); }
      catch { return new Set(); }
    },
    set interested(set) { localStorage.setItem(STORAGE.interested, JSON.stringify([...set])); },
    get interestedNotes() {
      try {
        const value = JSON.parse(localStorage.getItem(STORAGE.interestedNotes) || "{}");
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
      } catch { return {}; }
    },
    set interestedNotes(notes) { localStorage.setItem(STORAGE.interestedNotes, JSON.stringify(notes)); }
  };

  function first(obj, keys, fallback = null) {
    for (const key of keys) {
      const value = key.split(".").reduce((acc, part) => acc?.[part], obj);
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
  }

  function num(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || value === "") return null;
    const cleaned = String(value).replace(/[%,$\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeZone(raw) {
    const z = String(raw || "").trim();
    if (!z) return "—";
    if (/fvg|fair\s*value\s*gap/i.test(z)) return "FVG";
    return z;
  }

  function normalizeFormation(raw) {
    const s = String(raw || "").trim();
    if (!s) return "—";
    if (/bull|up|long|green/i.test(s)) return "Bullish";
    if (/bear|down|short|red/i.test(s)) return "Bearish";
    return s;
  }

  function extractRows(payload) {
    if (Array.isArray(payload)) return payload;
    const candidates = ["rows", "data", "results", "stocks", "signals", "items", "levels", "watchlist", "alerts"];
    for (const key of candidates) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    // Some Apps Script endpoints return an object keyed by ticker.
    if (payload && typeof payload === "object") {
      const ignored = new Set(["status","meta","settings","lastScan","last_scan","timestamp","message","success","count"]);
      const entries = Object.entries(payload).filter(([k, v]) => !ignored.has(k) && v && typeof v === "object" && !Array.isArray(v));
      if (entries.length >= 2 && entries.some(([k]) => /^[A-Z.\-]{1,7}$/i.test(k))) {
        return entries.map(([symbol, value]) => ({ symbol, ...value }));
      }
    }
    return [];
  }

  function normalizeRow(r, idx) {
    const range = first(r, ["range", "levelRange", "zoneRange"], null);
    let low = num(first(r, ["low","lower","zoneLow","zone_low","levelLow","level_low","rangeLow","bottom","min"], null));
    let high = num(first(r, ["high","upper","zoneHigh","zone_high","levelHigh","level_high","rangeHigh","top","max"], null));

    if ((low === null || high === null) && range && typeof range === "object") {
      low ??= num(first(range, ["low","lower","min","bottom"], null));
      high ??= num(first(range, ["high","upper","max","top"], null));
    }
    if ((low === null || high === null) && typeof range === "string") {
      const parts = range.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
      if (parts.length >= 2) { low ??= parts[0]; high ??= parts[1]; }
    }

    const price = num(first(r, ["price","currentPrice","current_price","last","close","lastPrice"], null));
    let distance = num(first(r, ["distance","distancePct","distance_pct","distancePercent","distance_percent","proximity","proximityPct"], null));
    if (distance === null && price !== null && low !== null && high !== null && price !== 0) {
      const nearest = price < low ? low : price > high ? high : price;
      distance = Math.abs((price - nearest) / price) * 100;
    }

    const symbol = String(first(r, ["symbol","ticker","code"], `ROW${idx+1}`)).trim().toUpperCase();
    const suppliedCompany = String(first(r, ["company","companyName","company_name","name"], "")).trim();
    const company = suppliedCompany && suppliedCompany.toUpperCase() !== symbol
      ? suppliedCompany
      : (STOCK_INFO[symbol]?.[0] || "");
    const zone = normalizeZone(first(r, ["zone","zoneType","zone_type","type","signalType","signal_type"], "—"));
    const formation = normalizeFormation(first(r, ["candleFormation","candle_formation","formation","direction","bias"], "—"));
    const suppliedMarket = String(first(r, ["market","exchange","venue"], "")).trim();
    const market = (!suppliedMarket || suppliedMarket.toUpperCase() === "US")
      ? (STOCK_INFO[symbol]?.[1] || suppliedMarket || "—")
      : suppliedMarket;
    const suppliedStatus = first(r, ["status","state","signalStatus","signal_status"], null);

    return {
      symbol, company, market, zone, candleFormation: formation, price, low, high, distance,
      formed: first(r, ["formed"], null),
      earningsDate: first(r, ["earningsDate","earnings_date","nextEarningsDate","next_earnings_date","earnings.date"], null),
      epsOutlook: first(r, ["epsOutlook","eps_outlook"], null),
      status: suppliedStatus ? String(suppliedStatus) : null,
      demo: Boolean(r.demo),
      raw: r
    };
  }

  function statusFor(row) {
    if (row.demo) return "Demo";
    if (row.distance !== null) {
      return Math.abs(row.distance) <= state.alertDistance ? "Within range" : "Watching";
    }
    return row.status || "Watching";
  }

  function statusClass(status) {
    const s = String(status).toLowerCase();
    if (s.includes("demo")) return "status-demo";
    if (s.includes("alert") || s.includes("within") || s.includes("near") || s.includes("active")) return "status-alert";
    return "status-tracking";
  }

  function fmt(n, digits = 2) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function fmtFormed(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
  }

  function isCurrentQuarterRow(row, now = new Date()) {
    const value = row?.formed;
    if (row?.demo || typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
    const formed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(formed.valueOf()) || formed.toISOString().slice(0, 10) !== value) return true;
    return formed.getUTCFullYear() === now.getFullYear()
      && Math.floor(formed.getUTCMonth() / 3) === Math.floor(now.getMonth() / 3);
  }

  function fmtDistance(n) {
    return n === null || n === undefined || Number.isNaN(n) ? "—" : `${fmt(Math.abs(n), 2)}%`;
  }

  function earningsDisplay(value, now = new Date()) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { text: "—", risk: "", exact: null };
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return { text: "—", risk: "", exact: null };
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const earningsUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const days = Math.round((earningsUtc - todayUtc) / 86_400_000);
    if (days < 0) return { text: "—", risk: "", exact: value };
    const text = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`;
    return { text, risk: days <= 1 ? "earnings-high" : days <= 3 ? "earnings-caution" : "", exact: value };
  }

  function epsOutlookDisplay(value) {
    if (!value || typeof value !== "object") return { text: "—", className: "", title: "EPS outlook unavailable" };
    const label = String(value.label || "").trim();
    const growth = num(value.growthPct);
    if (!label) return { text: "—", className: "", title: "EPS outlook unavailable" };
    const prefix = growth === null ? "" : `${growth > 0 ? "+" : ""}${fmt(growth, 1)}% `;
    const estimate = num(value.estimate);
    const prior = num(value.priorActual);
    const title = estimate === null || prior === null
      ? label
      : `Upcoming EPS estimate ${fmt(estimate, 2)} vs ${fmt(prior, 2)} in the same quarter last year`;
    return { text: `${prefix}${label}`, className: `eps-${label.toLowerCase()}`, title };
  }

  function currentQuarterLabel(now = new Date()) {
    return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  }

  function extractProgress(payload) {
    const total = num(first(payload || {}, ["total","progress.total","meta.total"], null));
    const processed = num(first(payload || {}, ["processed","progress.processed","meta.processed","cursor"], null));
    const safeTotal = total !== null && total > 0 ? Math.floor(total) : 100;
    const safeProcessed = processed !== null ? Math.min(safeTotal, Math.max(0, Math.floor(processed))) : 0;
    return { processed: safeProcessed, total: safeTotal };
  }

  function scanFreshness(payload, now = new Date()) {
    const raw = first(payload || {}, ["lastScan","last_scan","lastUpdated","last_updated","timestamp","meta.lastScan","meta.last_scan","updatedAt"], null);
    if (!raw) return { text: "Last scan time unavailable", stale: true };
    const date = new Date(raw);
    if (Number.isNaN(date.valueOf())) return { text: `Last daily scan · ${raw}`, stale: true };
    const sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
    return { text: `Last daily scan · ${date.toLocaleString()}`, stale: !sameDay };
  }

  function updateProgress() {
    const { processed, total } = scanProgress;
    const remaining = Math.max(0, total - processed);
    els.reporting.textContent = processed;
    els.reportingTotal.textContent = total;
    els.scanProgressBar.style.width = `${total ? (processed / total) * 100 : 0}%`;
    if (!feedConnected) {
      els.scanProgressBar.style.width = "0%";
      els.scanProgressLabel.textContent = state.scannerUrl ? "Scan progress unavailable" : "Scanner not connected";
      return;
    }
    els.scanProgressLabel.textContent = remaining
      ? `Scanning · ${remaining} remaining · ~${Math.ceil(remaining / 8)} min`
      : "Full scan complete";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }

  function tradingViewUrl(row) {
    const market = String(row.market || "").toUpperCase();
    let exchange = "";
    if (market.includes("NASDAQ")) exchange = "NASDAQ";
    else if (market.includes("ARCA")) exchange = "AMEX";
    else if (market.includes("NYSE") || market.includes("NEW YORK")) exchange = "NYSE";
    else if (market.includes("AMEX")) exchange = "AMEX";
    const instrument = exchange ? `${exchange}:${row.symbol}` : row.symbol;
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(instrument)}`;
  }

  function interestedSet() { return sharedInterested; }

  function setSyncStatus(text, error = false) {
    els.syncStatus.textContent = text;
    els.syncStatus.classList.toggle("sync-error", error);
  }

  function sharedPayload(merge = false) {
    return { interested: [...sharedInterested], notes: sharedNotes, merge };
  }

  async function requestSharedState(method = "GET", body = null) {
    const response = await fetch("/api/state", {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Sync failed (${response.status})`);
    return response.json();
  }

  function applySharedState(value) {
    sharedInterested = new Set(Array.isArray(value?.interested) ? value.interested : []);
    sharedNotes = value?.notes && typeof value.notes === "object" ? value.notes : {};
  }

  function saveSharedState() {
    const payload = sharedPayload(false);
    const revision = ++saveRevision;
    setSyncStatus("Saving…");
    saveQueue = saveQueue.then(async () => {
      const saved = await requestSharedState("PUT", payload);
      if (revision === saveRevision) {
        applySharedState(saved);
        setSyncStatus("Saved across devices");
      }
    }).catch(error => {
      console.error(error);
      setSyncStatus("Sync unavailable", true);
    });
    return saveQueue;
  }

  async function refreshSharedState() {
    if (document.hidden || document.activeElement?.matches?.("[data-note]")) return;
    try {
      const remote = await requestSharedState();
      applySharedState(remote);
      setSyncStatus("Saved across devices");
      render();
    } catch (error) {
      console.error(error);
      setSyncStatus("Sync unavailable", true);
    }
  }

  async function loadSharedState() {
    setSyncStatus("Syncing…");
    try {
      let remote = await requestSharedState();
      if (!localStorage.getItem(STORAGE.sharedStateMigrated)) {
        const localInterested = state.interested;
        const localNotes = state.interestedNotes;
        if (localInterested.size || Object.keys(localNotes).length) {
          applySharedState(remote);
          for (const symbol of localInterested) sharedInterested.add(symbol);
          sharedNotes = { ...sharedNotes, ...localNotes };
          remote = await requestSharedState("PUT", sharedPayload(true));
        }
        localStorage.setItem(STORAGE.sharedStateMigrated, "1");
      }
      applySharedState(remote);
      setSyncStatus("Saved across devices");
    } catch (error) {
      console.error(error);
      sharedInterested = state.interested;
      sharedNotes = state.interestedNotes;
      setSyncStatus("Sync unavailable", true);
    }
    render();
  }

  function filteredRows() {
    const q = searchTerm.trim().toLowerCase();
    const interest = interestedSet();
    return rows
      .filter(r => activeFilter === "interested" ? interest.has(r.symbol) : activeFilter === "all" || r.zone.toLowerCase() === activeFilter)
      .filter(r => !q || r.symbol.toLowerCase().includes(q) || r.company.toLowerCase().includes(q))
      .sort((a, b) => {
        const priority = Number(interest.has(b.symbol)) - Number(interest.has(a.symbol));
        if (priority) return priority;
        const ad = a.distance ?? Number.POSITIVE_INFINITY;
        const bd = b.distance ?? Number.POSITIVE_INFINITY;
        return Math.abs(ad) - Math.abs(bd) || a.symbol.localeCompare(b.symbol);
      });
  }

  function render() {
    els.quarterLabel.textContent = currentQuarterLabel();
    const interest = interestedSet();
    const notes = sharedNotes;
    const list = filteredRows();
    const interestedCount = new Set(rows.filter(r => interest.has(r.symbol)).map(r => r.symbol)).size;
    interestedFilter.textContent = `Interested ${interestedCount}`;
    els.body.innerHTML = list.map((r, i) => {
      const st = statusFor(r);
      const on = interest.has(r.symbol);
      const note = typeof notes[r.symbol] === "string" ? notes[r.symbol] : "";
      const earnings = earningsDisplay(r.earningsDate);
      const eps = epsOutlookDisplay(r.epsOutlook);
      return `<tr class="${on ? "interested" : ""}">
        <td class="num-col">${i + 1}</td>
        <td class="company-cell"><a class="company-link" href="${tradingViewUrl(r)}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(r.symbol)} in TradingView"><span class="company-line"><span class="company">${escapeHtml(r.company || r.symbol)}</span><span class="external-mark">↗</span></span><span class="ticker">${escapeHtml(r.symbol)}</span></a></td>
        <td><span class="status ${statusClass(st)}">${escapeHtml(st)}</span></td>
        <td class="distance">${fmtDistance(r.distance)}</td>
        <td><div class="interest-control"><button class="interest-btn ${on ? "on" : ""}" data-interest="${escapeHtml(r.symbol)}" title="${on ? "Remove from Interested" : "Mark Interested"}">${on ? "⚑" : "⚐"}</button><input class="interest-note" data-note="${escapeHtml(r.symbol)}" value="${escapeHtml(note)}" maxlength="120" placeholder="Add note…" aria-label="Note for ${escapeHtml(r.symbol)}"></div></td>
        <td><span class="earnings ${earnings.risk}"${earnings.exact ? ` title="${escapeHtml(earnings.exact)}"` : ""}>${earnings.text}</span></td>
        <td><span class="eps-outlook ${eps.className}" title="${escapeHtml(eps.title)}">${escapeHtml(eps.text)}</span></td>
        <td>${fmtFormed(r.formed)}</td>
        <td>${fmt(r.price)}</td>
      </tr>`;
    }).join("");

    els.empty.classList.toggle("hidden", list.length > 0);

    els.body.querySelectorAll("[data-interest]").forEach(btn => {
      btn.addEventListener("click", () => {
        const set = interestedSet();
        const symbol = btn.dataset.interest;
        set.has(symbol) ? set.delete(symbol) : set.add(symbol);
        sharedInterested = set;
        state.interested = set;
        saveSharedState();
        render();
      });
    });

    els.body.querySelectorAll("[data-note]").forEach(input => {
      input.addEventListener("input", () => {
        const notes = sharedNotes;
        const value = input.value.slice(0, 120);
        value ? notes[input.dataset.note] = value : delete notes[input.dataset.note];
        state.interestedNotes = notes;
        sharedNotes = notes;
        clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(saveSharedState, 500);
      });
    });

    updateProgress();
    const threshold = state.alertDistance;
    els.signalCount.textContent = String(rows.filter(r => r.distance !== null && Math.abs(r.distance) <= threshold).length).padStart(2, "0");
    els.fvgCount.textContent = String(rows.filter(r => r.zone === "FVG").length).padStart(2, "0");
  }

  function setConnectedUi(connected, detail = "", stale = false) {
    feedConnected = connected;
    els.feedBadge.textContent = connected ? (stale ? "Market data stale" : "US data feed connected") : "US data feed not connected";
    els.feedBadge.className = `badge ${connected ? (stale ? "badge-stale" : "badge-good") : "badge-warn"}`;
    els.connectPanel.classList.toggle("hidden", connected);
    els.lastScan.classList.toggle("stale", connected && stale);
    if (detail) els.lastScan.textContent = detail;
  }

  async function fetchScanner() {
    const url = state.scannerUrl;
    if (!url) {
      rows = [...DEMO_ROWS];
      scanProgress = { processed: 0, total: 100 };
      setConnectedUi(false, "Awaiting feed · last daily scan");
      render();
      return;
    }

    els.refresh.disabled = true;
    els.refresh.textContent = "Refreshing…";
    try {
      const u = new URL(url);
      u.searchParams.set("_", Date.now().toString());
      const res = await fetch(u.toString(), { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let payload;
      try { payload = JSON.parse(text); }
      catch {
        // Apps Script can occasionally wrap JSON in text; try to locate the JSON body.
        const start = Math.min(...["[","{"].map(ch => {
          const i = text.indexOf(ch);
          return i === -1 ? Number.POSITIVE_INFINITY : i;
        }));
        if (!Number.isFinite(start)) throw new Error("Scanner did not return JSON");
        payload = JSON.parse(text.slice(start));
      }

      if (payload?.success === false || payload?.error) {
        throw new Error(payload?.error?.message || payload?.error || payload?.message || "Scanner returned an error");
      }

      const incoming = extractRows(payload).map(normalizeRow).filter(r => r.symbol);
      const hasProgress = num(first(payload || {}, ["processed","progress.processed","meta.processed","cursor"], null)) !== null;
      if (!incoming.length && !hasProgress) throw new Error("Scanner connected, but no stock rows were found in its response.");

      rows = incoming.filter(row => row.zone === "FVG" && isCurrentQuarterRow(row));
      scanProgress = extractProgress(payload);
      const freshness = scanFreshness(payload);
      setConnectedUi(true, freshness.text, freshness.stale);
      render();
    } catch (err) {
      console.error(err);
      rows = [...DEMO_ROWS];
      scanProgress = { processed: 0, total: 100 };
      setConnectedUi(false, `Feed error · ${err.message}`);
      render();
    } finally {
      els.refresh.disabled = false;
      els.refresh.textContent = "Refresh";
    }
  }

  function saveAlertDistance(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    state.alertDistance = n;
    els.alertDistance.value = String(n);
    els.dialogAlertDistance.value = String(n);
    render();
  }

  const interestedFilter = document.createElement("button");
  interestedFilter.type = "button";
  interestedFilter.className = "seg";
  interestedFilter.dataset.filter = "interested";
  document.querySelector(".segmented").append(interestedFilter);

  els.search.addEventListener("input", e => { searchTerm = e.target.value; render(); });
  document.querySelectorAll(".seg").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  els.connect.addEventListener("click", () => {
    const url = els.scannerUrl.value.trim();
    if (!url) return;
    state.scannerUrl = url;
    els.dialogScannerUrl.value = url;
    fetchScanner();
  });

  els.refresh.addEventListener("click", fetchScanner);

  els.saveSettings.addEventListener("click", () => {
    saveAlertDistance(els.alertDistance.value);
  });

  els.settings.addEventListener("click", () => {
    els.dialogScannerUrl.value = state.scannerUrl;
    els.dialogAlertDistance.value = String(state.alertDistance);
    els.dialog.showModal();
  });

  els.dialogSave.addEventListener("click", () => {
    state.scannerUrl = els.dialogScannerUrl.value.trim();
    saveAlertDistance(els.dialogAlertDistance.value);
    els.scannerUrl.value = state.scannerUrl;
    els.dialog.close();
    fetchScanner();
  });

  els.disconnect.addEventListener("click", () => {
    state.scannerUrl = "";
    els.scannerUrl.value = "";
    els.dialogScannerUrl.value = "";
    els.dialog.close();
    fetchScanner();
  });

  // Initial state.
  els.quarterLabel.textContent = currentQuarterLabel();
  els.scannerUrl.value = state.scannerUrl;
  els.alertDistance.value = String(state.alertDistance);
  els.dialogScannerUrl.value = state.scannerUrl;
  els.dialogAlertDistance.value = String(state.alertDistance);
  render();
  loadSharedState();
  if (state.scannerUrl) fetchScanner();
  if (typeof setInterval === "function") {
    setInterval(() => {
      els.quarterLabel.textContent = currentQuarterLabel();
      if (state.scannerUrl) fetchScanner();
    }, 60_000);
    setInterval(refreshSharedState, 15_000);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshSharedState();
  });
})();
