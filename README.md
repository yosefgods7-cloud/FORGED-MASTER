# QUANT OS

**A Production-Grade Progressive Web App for Professional Trading**

QUANT OS is a modular, scalable, and flexible trading operating system designed for serious traders who demand control over their data, analytics, and risk management. Built with vanilla JavaScript and modern web standards, it runs entirely in your browser with full offline capabilities.

---

## 🚀 Features

### Core Capabilities
- **Trade Journaling**: Log, edit, and analyze every trade with unlimited custom metadata.
- **Portfolio Management**: Track multiple accounts, balances, equity, and unrealized P&L.
- **Risk Engine**: Real-time risk calculations, currency exposure aggregation, and correlation warnings.
- **Performance Analytics**: Dynamic breakdowns by strategy, session, pair, timeframe, or any custom tag.
- **Partial Close System**: Track partial exits with percentage-based profit realization.
- **Offline First**: Fully functional without an internet connection via IndexedDB and Service Workers.

### Design Philosophy
- **No Hardcoded Limits**: Define your own strategies, entry models, confluences, and tags.
- **Glassmorphism UI**: Modern, dark-mode default interface with smooth transitions.
- **Mobile-First**: Responsive design that works seamlessly on desktop, tablet, and mobile.
- **Professional Fintech Aesthetic**: Clean spacing, card-based layouts, and data-dense yet uncluttered views.

---

## 🛠️ Tech Stack

- **HTML5** - Semantic structure
- **TailwindCSS** - Utility-first styling (via CDN)
- **Vanilla JavaScript (ES6+)** - No frameworks, no build steps
- **IndexedDB** - Robust client-side storage for unlimited data
- **PWA Standards** - `manifest.json` + `service-worker.js` for installability and offline support

---

## 📂 Project Structure

```
/workspace
├── index.html              # Main application entry point
├── app.js                  # Main controller & initialization
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching logic
└── modules/
    ├── storage.js          # IndexedDB abstraction layer
    ├── journal.js          # Trade CRUD operations
    ├── portfolio.js        # Account & balance management
    ├── risk.js             # Risk engine & exposure logic
    ├── analytics.js        # Performance metrics & charts
    └── ui.js               # DOM rendering & interactions
```

---

## 🏃 Getting Started

### Option 1: Local Server (Recommended)
Since the app uses ES6 modules and Service Workers, it requires a local server to run correctly.

```bash
# Using Python 3
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open your browser to: **http://localhost:8080**

### Option 2: VS Code Live Server
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` and select "Open with Live Server".

### Installation as PWA
Once loaded in your browser:
- **Chrome/Edge**: Click the install icon in the address bar.
- **Safari (iOS)**: Tap "Share" → "Add to Home Screen".
- **Firefox**: Click the install icon in the address bar.

The app will cache all assets and function fully offline after the first load.

---

## 📖 User Guide

### 1. Dashboard
Your command center. Displays:
- Total Balance & Equity across all accounts.
- Win Rate, Total Trades, and Net Profit.
- Active Trades count and total open risk.
- Equity Curve chart (visualizing performance over time).
- Recent Trades list for quick access.

### 2. Journal Tab
Manage your trade history.
- **Add Trade**: Click the floating "+" button.
  - Enter basic details (Pair, Direction, Entry, SL, TP, Lots).
  - **Dynamic Metadata**: Add any field you need (e.g., `Strategy`, `Session`, `Confluences`). Click "Add Field" to create custom key-value pairs.
  - **Partials**: Define partial close levels if applicable.
- **Edit/Delete**: Click a trade card to expand details, then use the edit/delete actions.
- **Filtering**: Search by pair, strategy, or any custom tag.

### 3. Portfolio Tab
Manage multiple trading accounts.
- **Add Account**: Create new accounts with initial balance.
- **View Details**: See realized vs. unrealized P&L per account.
- **Currency Exposure**: Visual heatmap showing your net long/short exposure per currency (e.g., Long EUR, Short USD).

### 4. Analytics Tab
Deep dive into performance.
- **Overview**: Win rate, Profit Factor, Average R:R, Expectancy.
- **Breakdowns**: Automatically groups profits by any metadata field found in your trades (e.g., Profit by "Strategy", Profit by "Session").
- **Monthly Performance**: Calendar view of winning/losing months.

### 5. Settings & Data
- **Export Data**: Download a full JSON backup of your trades, accounts, and settings.
- **Import Data**: Restore from a previous JSON backup.
- **Risk Thresholds**: Set global risk limits to trigger warnings when exposure is too high.

---

## 🧠 Data Model Flexibility

QUANT OS does not force a specific trading style. The `metadata` object in every trade is completely dynamic.

**Example Trade Metadata:**
```json
{
  "strategy": "SMC Reversal",
  "entry_model": "Order Block + FVG",
  "confluences": ["Liquidity Sweep", "Discount Zone", "H4 Structure"],
  "session": "London Open",
  "timeframe": "M15",
  "tags": ["high probability", "news day", "earnings"],
  "psychology_score": 8,
  "mistake_type": "none"
}
```
*You can add, edit, or remove any of these fields on the fly.*

---

## 🔒 Privacy & Security

- **Local First**: All data is stored locally in your browser's IndexedDB. Nothing is sent to external servers.
- **No Tracking**: No analytics scripts, no cookies, no third-party dependencies beyond TailwindCSS (loaded via CDN, cached locally after first load).
- **Data Ownership**: You own your data. Export it anytime via the Settings panel.

---

## 🤝 Contributing

This project is built as a reference architecture for modular, framework-free web applications. Feel free to fork and extend:
- Add new chart types in `analytics.js`.
- Extend the risk engine in `risk.js`.
- Customize the UI themes in `ui.js`.

---

## 📄 License

MIT License - Free for personal and commercial use.

---

## 🆘 Troubleshooting

**App doesn't load?**
- Ensure you are running via a local server (not just opening `file://`).
- Check browser console for CORS or module errors.

**Data not saving?**
- Verify your browser supports IndexedDB (all modern browsers do).
- Check if private/incognito mode is blocking storage (try normal mode).

**PWA not installing?**
- Ensure the site is served over HTTPS (or localhost).
- Verify the service worker is registered in DevTools > Application > Service Workers.

---

**Built with precision for traders who refuse to compromise.**