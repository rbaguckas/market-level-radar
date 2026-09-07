# Market Level Radar

Static frontend migration of the Market Level Radar dashboard.

## Preserved behavior

- 100 large-cap US-stock daily scanner
- Calendar-quarter reset
- First qualifying quarterly FVG
- Three-candle FVG rule
- Order-block rule
- First-valid-zone logic
- `Candle formation` label instead of `Bias`
- Case-insensitive partial ticker/company search
- FVG and Interested filters
- Per-stock Interested flag (`⚐` / `⚑`) stored locally in the browser
- Upcoming earnings dates with relative risk labels when `earningsDate` is supplied by the scanner
- Numbered rows
- Priority column order: `#`, Company/Symbol, Status, Distance, Interested, then the remaining analysis fields
- Configurable alert distance
- Scanner Web App URL stored locally in the browser

## Data flow

Browser dashboard → Google Apps Script Web App → Twelve Data

The frontend never needs the Twelve Data API key. Keep the API key in the Apps Script scanner.

## Local use

Open `public/index.html`, or serve `public/` with any static HTTP server.

## Cloudflare Pages from GitHub

1. Create a GitHub repository named `market-level-radar`.
2. Add this project to the repository and push to `main`.
3. In Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository**.
4. Select the GitHub repository.
5. Production branch: `main`
6. Framework preset: none
7. Build command: `exit 0` (or leave blank)
8. Build output directory: `public`
9. Deploy.

Cloudflare will create a `*.pages.dev` address and redeploy automatically after pushes to the repository.

## Cloudflare Workers Static Assets alternative

This repo also contains `wrangler.jsonc`.

With Node.js installed:

```bash
npm install
npm run dev
npm run deploy
```

Cloudflare currently recommends Workers Static Assets for new Worker-based static deployments.

## Scanner connection

The current ChatGPT Site stores the Scanner Web App URL in that site's browser localStorage. Browser localStorage does not transfer between domains.

On the new Cloudflare-hosted Radar, paste the existing Google Apps Script URL into **Scanner Web App URL** once and click **Connect**. It should normally end in `/exec`.

## Expected scanner response

The frontend intentionally accepts several common JSON shapes so the existing Apps Script can usually be used unchanged. It recognizes arrays directly or arrays under keys such as:

- `rows`
- `data`
- `results`
- `stocks`
- `signals`
- `items`
- `levels`
- `watchlist`

Typical row fields it recognizes include `symbol`/`ticker`, `company`/`name`, `market`/`exchange`, `zone`/`type`, `candleFormation`/`direction`/`bias`, `price`, low/high zone bounds, distance, and status.

If your current Apps Script response uses different field names, adjust only the normalization section in `public/app.js`; the scanner calculation logic itself does not need to move.

An optional `earningsDate` field in `YYYY-MM-DD` format is preserved on each normalized row and displayed as a relative value. Missing or invalid dates display as `—`.

### Alpha Vantage earnings calendar

The Apps Script scanner can use Alpha Vantage only for upcoming earnings while keeping Twelve Data unchanged for candles. Add `scanner/Earnings.gs` to the Apps Script project, store the Alpha Vantage key in the `ALPHA_VANTAGE_API_KEY` script property, call `refreshEarningsCalendar_(props)` from `scanBatch()`, and wrap the response rows with `addEarningsDates_(rows, props)` in `doGet()`.

The integration requests the bulk three-month `EARNINGS_CALENDAR` CSV once per UTC day, keeps only dates for the configured 100-stock universe, and caches the resulting symbol-to-date map in Script Properties. Failed requests wait six hours before retrying.
Cloudflare deployment trigger.

## PIN protection

The Worker protects the dashboard and every file in `public/` before static assets are served. For local development, create a local-only `.dev.vars` file:

```text
SITE_PIN=choose-a-private-pin
```

Then run:

```sh
npm install
npm run dev
```

Set the production PIN as an encrypted Cloudflare secret. From the project directory, run this command and enter the PIN when Wrangler prompts:

```sh
npx wrangler secret put SITE_PIN
```

Deploy after setting the secret:

```sh
npm run deploy
```

Do not put the production PIN in `wrangler.jsonc`, source control, or a plaintext Wrangler variable. Changing `SITE_PIN` invalidates existing login cookies.
