# Loan Payoff Planner PWA

A browser-based loan payoff planning application that stores your planning data locally, projects future balances, and visualizes payoff timelines. It is designed to run as an installable Progressive Web App (PWA) after being served from a supported origin.

The application uses:

- **IndexedDB** for browser-local storage of loans, lump sums, and simulation settings.
- **Chart.js** for the combined-debt and per-loan payoff charts.
- **Plain HTML, CSS, and JavaScript ES modules**; no server-side database or build step is required.
- A **service worker** that pre-caches the complete application shell for offline use.

> **Planning-only notice:** Projections use monthly modeling assumptions and can differ from lender statements, payment posting times, daily-interest calculations, fees, capitalization rules, or loan-specific terms. Use the app for planning, not as an official payoff quote.

---

## Features at a Glance

### Loan management

- Add, edit, and delete multiple loans.
- Require unique loan names.
- Record principal, existing accrued interest, APR, interest type, payment day, required monthly payment, and recurring additional payment.
- Preserve **creation order** for display order and strategy tie-breaking.
- Support simple interest and monthly compounding.

### Lump-sum planning

- Schedule one-time payments by month and year.
- Apply a lump sum to a specific loan, using Avalanche, or using Snowball.
- Edit or delete scheduled lump sums.
- Automatically remove lump sums assigned to a loan that is deleted.

### Payoff simulation

- Starts from a user-selected month.
- Runs until every loan is paid off or the configured simulation limit is reached.
- Applies interest before payments each month.
- Applies every payment to **accrued interest first, then principal**.
- Handles simple interest and monthly compounding.
- Shows warnings for negative amortization and for a simulation that reaches its maximum length before payoff.

### Debt strategies and rollover

- **Avalanche:** Direct extra money to the highest-APR active loan first.
- **Snowball:** Direct extra money to the lowest-balance active loan first.
- Break equal APR or equal balance ties with loan creation order.
- Supports a global payment-rollover setting.
- Uses the selected **Option A** rollover behavior:
  - Only unused money from payments already made in the current month is immediately redirected.
  - A paid-off loan’s normal monthly payment becomes permanent strategy capacity starting in the next simulated month.

### Analysis and exports

- Show summary metrics and a payoff-summary table.
- Show a combined remaining-debt chart.
- Show a collapsible chart section for every loan.
- Export one detailed CSV per loan.
- Export one detailed combined portfolio CSV.
- Export all CSVs as separate browser downloads.
- Export each chart as a PNG image.
- Export all saved inputs as JSON and import a replacement JSON backup.

### Offline/PWA behavior

- Includes a web app manifest and service worker.
- Uses a strict pre-cache list for the app pages, modules, styles, icons, and local Chart.js copy.
- Uses a cache-first fetch strategy after installation.
- Stores planning data in IndexedDB, so saved browser-local data remains available without a network connection.

---

## Project Structure

```text
Loan-Payoff-Planner-PWA/
├── index.html
├── graphs.html
├── manifest.json
├── service-worker.js
├── package.json
├── README.md
├── assets/
│   └── payments_180dp_1F1F1F.png
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── chartManager.js
│   ├── db.js
│   ├── exportManager.js
│   ├── loanManager.js
│   ├── lumpSumManager.js
│   ├── settingsManager.js
│   ├── simulationEngine.js
│   ├── simulationModels.js
│   ├── strategyEngine.js
│   └── validation.js
└── libs/
    └── chartjs/
        └── chart.js
```

---

## Running the App Locally

Do **not** open `index.html` by double-clicking it or through a `file:///` address. JavaScript ES modules and service workers need an HTTP(S) origin.

From the project folder, run a local server. For example:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

On Windows, this alternative may be useful:

```bash
py -m http.server 8080
```

You can also use VS Code Live Server.

### Install as a PWA

For installation on a phone or tablet, deploy the project to HTTPS hosting, open it in the browser, and use the browser’s install/add-to-home-screen action. On iPhone or iPad Safari, use:

```text
Share → Add to Home Screen
```

---

## Local Chart.js Requirement

The project intentionally uses a local Chart.js browser build instead of a CDN dependency. The required location is:

```text
libs/chartjs/chart.js
```

Both `graphs.html` and `service-worker.js` expect this exact path and filename.

The service worker uses a strict `cache.addAll()` installation process. If any file in its cache list is missing, including `libs/chartjs/chart.js`, service-worker installation fails. This is intentional: when installation succeeds, the app shell and chart library are already available offline.

---

## Data Storage and Backup

All loan, lump-sum, and settings data is stored in the browser’s IndexedDB database named:

```text
loanPayoffPlannerDB
```

No server-side account or cloud synchronization is used.

Use **Export JSON** regularly to create a backup. Importing a JSON backup replaces the current saved application data after validation succeeds.

---

## Core Financial Rules

### Interest calculation

For simple interest:

```text
monthly interest = principal × APR / 100 / 12
```

For monthly compounding:

```text
monthly interest = (principal + accrued interest) × APR / 100 / 12
```

### Payment order

Every payment follows this order:

```text
1. Accrued interest
2. Principal
```

This rule applies to recurring payments, lump sums, Avalanche/Snowball allocations, rollover funds, and same-month excess cash.

### Rounding

Financial values are rounded to cents during calculation steps.

### Rollover behavior

When rollover is enabled and a loan is paid off:

- Any portion of that month’s already-scheduled payment that was not needed is eligible for immediate reallocation.
- The loan’s full normal payment amount, meaning minimum payment plus recurring additional payment, becomes permanent strategy budget beginning in the next simulation month.

---

## Updating the PWA

When you change files that are pre-cached by `service-worker.js`, change the cache name as well. For example:

```js
const CACHE_NAME = 'loan-payoff-planner-cache-v2';
```

This tells the browser to install a new cache rather than continuing to serve an older cached app shell.

After deploying an updated version, refresh the app. If an old worker appears to remain active, use the browser’s developer tools to unregister the service worker or clear the site’s stored data once, then reload.

---

# File and Function Reference

This section describes the purpose of every project file and the functions defined in the application-owned source files.

## Root Files

### `index.html`

The Loan Management page. It contains:

- Loan add/edit form.
- Lump-sum add/edit form.
- Simulation settings form.
- Loans and lump-sums lists.
- JSON backup/import controls.
- Navigation to the Analysis page.
- The entry-point module script: `./js/app.js`.

### `graphs.html`

The Analysis and Graphs page. It contains:

- Overall warning region.
- Combined debt chart canvas.
- Summary metrics and payoff table containers.
- Collapsible per-loan chart container.
- CSV and PNG export controls.
- Local Chart.js script reference: `./libs/chartjs/chart.js`.
- The analysis module script: `./js/chartManager.js`.

### `manifest.json`

Defines PWA installation metadata:

- Application name and short name.
- Description.
- Start URL and scope.
- Standalone display mode.
- Theme/background colors.
- Application icon reference.

### `service-worker.js`

Implements offline app-shell caching.

Key behavior:

- Defines `CACHE_NAME` to version the cache.
- Defines `FILES_TO_CACHE`, the explicit list of required pages, modules, CSS, icons, and the local Chart.js library.
- On `install`, opens the named cache and adds every required file.
- Calls `self.skipWaiting()` so the newly installed worker can activate immediately.
- On `activate`, removes caches whose names do not equal `CACHE_NAME` and calls `self.clients.claim()`.
- On `fetch`, uses cache-first behavior: return a cached response when one exists, otherwise fetch from the network.

### `package.json`

Declares the project as private and configures Node-compatible tooling to treat `.js` files as ES modules through:

```json
"type": "module"
```

No package-manager dependencies or build scripts are currently required.

### `README.md`

Project documentation, setup instructions, feature overview, financial-modeling notes, and this file/function reference.

---

## Asset Files

### `assets/icon-192.png`

PWA icon asset intended for standard application/icon usage.

### `assets/icon-512.png`

Larger PWA icon asset intended for installation and high-resolution contexts.

### `assets/payments_180dp_1F1F1F.png`

Payment-themed image used as the browser favicon, Apple touch icon, and manifest icon.

### `libs/chartjs/chart.js`

Local browser build of the third-party Chart.js library. It supplies the global `Chart` constructor used by `chartManager.js` to render line charts. This is a vendor library; its internal functions are not documented here because they are maintained by Chart.js rather than this project.

---

## Styling

### `css/styles.css`

Defines the complete dark visual design and responsive layout, including:

- Global dark color variables.
- Page containers and headers.
- Form grids, inputs, selects, buttons, and focus states.
- Loan/lump-sum list cards.
- Status, warning, and metric styles.
- Combined and individual chart layouts.
- Collapsible loan-chart sections.
- Summary table styling.
- Fixed bottom navigation.
- Responsive breakpoints for tablet and phone widths.

No JavaScript functions are defined in this file.

---

## JavaScript Modules

### `js/app.js`

Entry point for `index.html`. It initializes the Loan Management page, binds UI events, coordinates forms and lists, and registers the service worker.

Functions:

- `initManagementPage()` — Finds management-page elements, populates controls, loads saved settings, renders lists, and binds all loan, lump-sum, settings, import, and export event handlers.
- `refreshLists()` *(nested in `initManagementPage`)* — Reloads loans and lump sums, updates the lump-sum loan selector, and re-renders both lists.
- `resetLoanEdit()` *(nested in `initManagementPage`)* — Resets the loan form and returns it from edit mode to add mode.
- `resetLumpEdit()` *(nested in `initManagementPage`)* — Resets the lump-sum form and returns it from edit mode to add mode.
- `showStatus(container, message, type)` — Displays a temporary success or error status message.
- `escapeHtml(value)` — Encodes text before putting it into generated HTML.
- `registerServiceWorker()` — Registers `service-worker.js` after the window has loaded when service workers are supported.

### `js/chartManager.js`

Entry point for `graphs.html`. It retrieves stored inputs, runs the payoff simulation, renders charts and summary UI, binds export controls, and registers the service worker.

Functions:

- `initAnalysisPage()` — Waits for Chart.js, loads loans/lump sums/settings, runs the simulation, and renders analysis content or an empty state.
- `renderWarnings(warnings)` — Renders portfolio-level and loan-level warning messages.
- `renderMetrics(loans, result)` — Renders total loans, current debt, projected payoff date, months simulated, and interest-paid metrics.
- `renderSummaryTable(loans, result)` — Builds the payoff summary table in creation order.
- `renderCombinedChart(result)` — Creates the combined remaining-debt line chart.
- `renderLoanSections(loans, result)` — Creates one collapsible chart section per loan, including metrics, warnings, CSV/PNG buttons, and a line chart.
- `bindExports(loans, result)` — Attaches handlers for combined CSV/PNG, export-all CSV, and individual loan CSV/PNG controls.
- `chartOptions(title)` — Returns the common dark-theme Chart.js configuration.
- `destroyChart(key)` — Destroys a prior chart instance before a replacement is created.
- `waitForChart()` — Waits briefly for the local Chart.js script to expose `window.Chart`; throws a descriptive error if it never loads.
- `escapeHtml(value)` — Encodes text before generated HTML insertion.
- `registerServiceWorker()` — Registers `service-worker.js` after window load.

### `js/db.js`

IndexedDB data-access layer. It owns database initialization, object-store operations, normalization, import/export, and transaction helpers.

Constants:

- `DB_NAME` — IndexedDB database name: `loanPayoffPlannerDB`.
- `DB_VERSION` — Database schema version.
- `STORES` — Object-store names for loans, lump sums, and settings.
- `DEFAULT_SETTINGS` — Default simulation settings.

Functions:

- `openDb()` — Opens the IndexedDB database, creates stores/indexes during upgrade, caches the connection promise, and handles version changes.
- `requestPromise(request)` — Converts an IndexedDB request into a Promise.
- `transactionDone(transaction)` — Resolves or rejects when an IndexedDB transaction completes, errors, or aborts.
- `getStore(storeName, mode)` — Opens an object store for read-only or read-write use.
- `getAllLoans()` — Returns loans sorted by creation order.
- `getLoan(id)` — Retrieves one loan by ID.
- `addLoan(input)` — Validates input, enforces unique names, assigns creation order, and adds a loan.
- `updateLoan(input)` — Validates an edited loan, preserves ID/creation order, enforces uniqueness, and saves it.
- `deleteLoan(id)` — Deletes a loan and all lump sums specifically assigned to it in one transaction.
- `getLoanByName(name)` — Looks up a loan using the unique name index.
- `getAllLumpSums()` — Returns lump sums sorted by scheduled month then ID.
- `addLumpSum(input)` — Validates and adds a lump sum; confirms the target loan exists for specific-loan allocations.
- `updateLumpSum(input)` — Validates and saves an existing lump sum.
- `deleteLumpSum(id)` — Deletes a lump sum by ID.
- `getSettings()` — Returns saved settings merged with defaults.
- `saveSettings(input)` — Validates and saves global simulation settings.
- `exportDatabase()` — Returns a JSON-ready backup object containing loans, lump sums, settings, version, and export timestamp.
- `importDatabase(data)` — Validates a backup and replaces stored application data in one transaction.
- `validateImportData(data)` — Ensures an import has valid structures, unique loan names, valid settings, and valid specific-loan references.
- `normalizeLoan(loan)` — Converts loan fields into the persisted numeric/string shape and enforces monthly compounding metadata.
- `normalizeLumpSum(lump)` — Converts lump-sum fields into the persisted numeric/string shape.

### `js/loanManager.js`

Loan-form and loan-list UI helper module.

Functions:

- `populatePaymentDaySelect(select)` — Adds payment-day options 1 through 31 to a select element.
- `loanFromForm(form)` — Reads the loan form into a loan data object.
- `saveLoanFromForm(form)` — Adds a new loan or updates an existing loan depending on whether a loan ID is present.
- `resetLoanForm(form)` — Clears the loan form and restores default accrued interest, additional payment, and payment-day values.
- `populateLoanForm(form, id)` — Retrieves a loan and loads it into the form for editing.
- `renderLoanList(container, callbacks)` — Renders saved loans with edit/delete buttons and invokes supplied callbacks.
- `escapeHtml(value)` — Encodes loan names for safe HTML rendering.

The module also re-exports `deleteLoan` and `getAllLoans` for the page controller.

### `js/lumpSumManager.js`

Lump-sum form and list UI helper module.

Functions:

- `lumpSumFromForm(form)` — Reads the lump-sum form into a lump-sum data object.
- `saveLumpSumFromForm(form)` — Adds or updates a lump sum based on whether an ID is present.
- `resetLumpSumForm(form)` — Clears the form, clears the edit ID, and updates target-loan visibility.
- `toggleTargetLoan(form)` — Shows/enables the target-loan field only for the specific-loan allocation method.
- `populateLoanOptions(select, loans, selectedId)` — Builds the target-loan dropdown from current loans.
- `populateLumpSumForm(form, lumpSum)` — Loads an existing lump sum into the edit form.
- `renderLumpSumList(container, loans, callbacks)` — Renders scheduled lump sums with edit/delete buttons.
- `describeMethod(lump, lookup)` — Produces a human-readable allocation-method description.

The module also re-exports `deleteLumpSum` for the page controller.

### `js/settingsManager.js`

Simulation-settings form helper module.

Functions:

- `loadSettingsIntoForm(form)` — Loads stored settings into the form and applies the current rollover-strategy enabled/disabled state.
- `toggleRolloverStrategy(form)` — Disables the rollover-strategy select when rollover is off.
- `saveSettingsFromForm(form)` — Reads settings fields and saves them through the database layer.

### `js/simulationModels.js`

Loan-level financial model functions. This module applies interest and payments while preserving the interest-first payment rule.

Functions:

- `createRuntimeLoan(loan)` — Converts a saved loan into a mutable simulation object with balances, cumulative metrics, payoff state, and rollover tracking.
- `cloneLoans(loans)` — Makes shallow runtime-loan copies for before/after payoff comparison.
- `applyInterest(loan)` — Calculates and adds one month of simple or monthly-compounded interest.
- `applyPayment(loan, amount)` — Applies money to accrued interest first and principal second; returns payment/interest/principal/excess details.
- `updatePayoffStatus(loan, monthNumber, yearMonth)` — Marks a loan paid off when its balance is at or below the payoff threshold and records its payoff timing.
- `createLoanSnapshot(loan, activity)` — Produces one loan’s chart/CSV-ready monthly snapshot including balances and activity deltas.
- `calculatePortfolioBalance(loans)` — Sums total balances across loans.
- `calculatePortfolioInterestPaid(loans)` — Sums cumulative interest payments across loans.
- `calculatePortfolioPrincipalPaid(loans)` — Sums cumulative principal payments across loans.
- `allLoansPaidOff(loans)` — Returns whether no active loan balance remains.
- `calculateMonthlyRate(loan)` — Converts a loan APR into the supported monthly rate and validates monthly compounding metadata.
- `refreshTotals(loan)` — Recalculates `totalBalance` from principal plus accrued interest.
- `roundMoney(value)` — Re-exported money-rounding helper.

### `js/strategyEngine.js`

Pure strategy-targeting module. It decides which active loan should receive strategy-directed money but does not alter balances.

Constants:

- `STRATEGIES` — Supported values: `avalanche` and `snowball`.

Functions:

- `getActiveLoans(loans)` — Returns loans that are not paid off and have a balance above the payoff threshold.
- `sortLoansByStrategy(loans, strategy)` — Sorts active loans by highest APR for Avalanche or lowest balance for Snowball; both use creation order as the tie-breaker.
- `getTargetLoan(loans, strategy)` — Returns the first eligible loan in the selected strategy order.
- `getNewlyPaidOffLoans(previousLoans, currentLoans)` — Compares before/after runtime-loan states to identify loans that became paid off during a month.

### `js/simulationEngine.js`

Portfolio-level monthly payoff simulation. It orchestrates interest accrual, lump sums, recurring payments, strategy allocation, rollover, snapshots, and warnings.

Functions:

- `runSimulation({ loans, lumpSums, settings })` — Main simulation entry point. Builds runtime loans, processes every simulated month, creates snapshots/results, and returns summary data plus warnings.
- `processLumpSum(loans, lump, activity)` — Applies a specific-loan lump sum or directs it through Avalanche/Snowball allocation.
- `allocateByStrategy(loans, amount, strategy, activity, monthNumber, yearMonth)` — Sends money to active strategy targets until the amount is spent or no target remains.
- `allocateCurrentMonthExcess(loans, pool, strategy, activity, monthNumber, yearMonth)` — Reallocates only actual same-month excess funds under Option A rollover behavior.
- `createActivityLedger(loans)` — Creates per-loan monthly tracking entries for interest added and payment components.
- `recordPayment(activity, loanId, result)` — Adds a payment result to the monthly activity ledger.
- `createMonthlySnapshot(loans, activity, yearMonth, monthNumber)` — Produces one portfolio snapshot for charts and CSV exports.
- `buildSummary(loans, snapshots, permanentStrategyBudget)` — Builds portfolio-level result metrics.
- `buildLoanResults(loans)` — Builds final per-loan payoff result records.
- `pushWarning(warnings, keys, warning)` — Adds a warning only once for its warning type and loan/portfolio scope.
- `parseYearMonth(yearMonth)` — Converts a `YYYY-MM` string into numeric year/month parts.
- `buildYearMonth(start, offset)` — Returns the simulated month after an offset from the start month.
- `latestPayoffDate(loans)` — Returns the latest payoff month among loans.
- `emptySummary()` — Returns the default result summary for an empty portfolio.
- `simulationDisclaimer()` — Returns a planning-estimate disclaimer string.

### `js/exportManager.js`

Download and export utility module.

Functions:

- `downloadText(filename, text, type)` — Wraps text in a Blob and initiates a browser download.
- `downloadBlob(filename, blob)` — Creates a temporary object URL and downloads a Blob.
- `exportDatabaseJson(data)` — Downloads a JSON backup with a date-stamped filename.
- `loanCsv(result, loanId)` — Creates detailed per-loan CSV content from simulation snapshots.
- `portfolioCsv(result)` — Creates detailed combined-portfolio CSV content from simulation snapshots.
- `exportCanvasPng(canvas, filename)` — Downloads a chart canvas as a PNG file.
- `safeFilename(name)` — Converts a loan name into a safe filename component.
- `toCsv(rows)` — Converts arrays of CSV rows to text.
- `escapeCsv(value)` — Escapes commas, quotes, and line breaks in a CSV field.
- `dateStamp()` — Returns the current ISO date for backup filenames.

### `js/validation.js`

Shared validation, formatting, date, and financial helper module.

Constants:

- `PAYOFF_EPSILON` — Small balance threshold used to treat near-zero balances as paid off.

Functions:

- `roundMoney(value)` — Rounds a numeric value to cents.
- `isYearMonth(value)` — Validates `YYYY-MM` values.
- `assertLoanInput(input)` — Validates all required loan fields and their allowed ranges.
- `assertLumpSumInput(input)` — Validates lump-sum amount, month, allocation method, and target loan when required.
- `assertSettingsInput(input)` — Validates simulation start month, maximum years, and rollover strategy.
- `assertNonNegative(value, label)` — Validates that a numeric field is finite and non-negative.
- `getCurrentYearMonth()` — Returns the current local month in `YYYY-MM` format.
- `formatCurrency(value)` — Formats a value as localized USD currency.
- `formatYearMonth(yearMonth)` — Formats `YYYY-MM` as a localized abbreviated month and year.

