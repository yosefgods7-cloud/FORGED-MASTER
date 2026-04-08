/**
 * Analytics Engine Module
 * Computes performance metrics, win rates, and dynamic analysis from metadata
 */

class AnalyticsEngine {
    constructor() {
        this.trades = [];
        this.accounts = [];
    }

    async init() {
        this.trades = await storage.getTrades();
        this.accounts = await storage.getAccounts();
        return this;
    }

    /**
     * Calculate basic performance metrics
     */
    calculatePerformanceMetrics(trades = this.trades) {
        const closedTrades = trades.filter(t => t.status === 'closed' || (t.partials && t.partials.length > 0));
        const winningTrades = closedTrades.filter(t => t.profit > 0);
        const losingTrades = closedTrades.filter(t => t.profit < 0);

        const totalTrades = closedTrades.length;
        const winCount = winningTrades.length;
        const lossCount = losingTrades.length;
        const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

        // Calculate profit/loss
        const grossProfit = winningTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit || 0), 0));
        const netProfit = grossProfit - grossLoss;

        // Average win/loss
        const avgWin = winCount > 0 ? grossProfit / winCount : 0;
        const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;

        // Profit factor
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

        // Best and worst trades
        const sortedByProfit = [...closedTrades].sort((a, b) => b.profit - a.profit);
        const bestTrade = sortedByProfit[0]?.profit || 0;
        const worstTrade = sortedByProfit[sortedByProfit.length - 1]?.profit || 0;

        // Average R:R
        const rrValues = closedTrades.filter(t => t.rrRatio).map(t => parseFloat(t.rrRatio));
        const avgRR = rrValues.length > 0 
            ? rrValues.reduce((sum, r) => sum + r, 0) / rrValues.length 
            : 0;

        return {
            totalTrades,
            winCount,
            lossCount,
            winRate: winRate.toFixed(2),
            grossProfit,
            grossLoss,
            netProfit,
            avgWin,
            avgLoss,
            profitFactor: isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞',
            bestTrade,
            worstTrade,
            avgRR: avgRR.toFixed(2)
        };
    }

    /**
     * Analyze profit by any metadata field dynamically
     */
    analyzeByField(fieldName, trades = this.trades) {
        const analysis = {};
        const closedTrades = trades.filter(t => t.status === 'closed' || t.profit !== undefined);

        closedTrades.forEach(trade => {
            let value;

            // Check if field is in metadata or direct property
            if (trade.metadata && trade.metadata[fieldName]) {
                value = trade.metadata[fieldName];
            } else if (trade[fieldName]) {
                value = trade[fieldName];
            } else {
                value = 'Unknown';
            }

            // Handle array fields (like confluences, tags)
            if (Array.isArray(value)) {
                value.forEach(v => {
                    if (!analysis[v]) {
                        analysis[v] = { count: 0, profit: 0, wins: 0, losses: 0 };
                    }
                    analysis[v].count++;
                    analysis[v].profit += trade.profit || 0;
                    if (trade.profit > 0) analysis[v].wins++;
                    if (trade.profit < 0) analysis[v].losses++;
                });
            } else {
                if (!analysis[value]) {
                    analysis[value] = { count: 0, profit: 0, wins: 0, losses: 0 };
                }
                analysis[value].count++;
                analysis[value].profit += trade.profit || 0;
                if (trade.profit > 0) analysis[value].wins++;
                if (trade.profit < 0) analysis[value].losses++;
            }
        });

        // Calculate win rate for each category
        Object.keys(analysis).forEach(key => {
            const data = analysis[key];
            data.winRate = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(2) : 0;
            data.avgProfit = data.count > 0 ? (data.profit / data.count).toFixed(2) : 0;
        });

        // Sort by profit
        return Object.entries(analysis)
            .sort(([, a], [, b]) => b.profit - a.profit)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
    }

    /**
     * Get all unique metadata fields from trades
     */
    getMetadataFields(trades = this.trades) {
        const fields = new Set();

        trades.forEach(trade => {
            if (trade.metadata) {
                Object.keys(trade.metadata).forEach(key => fields.add(key));
            }
        });

        return Array.from(fields);
    }

    /**
     * Analyze profit by pair
     */
    analyzeByPair(trades = this.trades) {
        return this.analyzeByField('pair', trades);
    }

    /**
     * Analyze profit by strategy (from metadata)
     */
    analyzeByStrategy(trades = this.trades) {
        return this.analyzeByField('strategy', trades);
    }

    /**
     * Analyze profit by session (from metadata)
     */
    analyzeBySession(trades = this.trades) {
        return this.analyzeByField('session', trades);
    }

    /**
     * Analyze profit by entry model (from metadata)
     */
    analyzeByEntryModel(trades = this.trades) {
        return this.analyzeByField('entry_model', trades);
    }

    /**
     * Analyze profit by timeframe (from metadata)
     */
    analyzeByTimeframe(trades = this.trades) {
        return this.analyzeByField('timeframe', trades);
    }

    /**
     * Monthly performance analysis
     */
    analyzeMonthly(trades = this.trades) {
        const monthly = {};

        trades.filter(t => t.status === 'closed' || t.profit !== undefined).forEach(trade => {
            const date = new Date(trade.timestamp || trade.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthly[monthKey]) {
                monthly[monthKey] = { count: 0, profit: 0, wins: 0, losses: 0 };
            }

            monthly[monthKey].count++;
            monthly[monthKey].profit += trade.profit || 0;
            if (trade.profit > 0) monthly[monthKey].wins++;
            if (trade.profit < 0) monthly[monthKey].losses++;
        });

        // Calculate win rate and sort by date
        Object.keys(monthly).forEach(key => {
            const data = monthly[key];
            data.winRate = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(2) : 0;
        });

        return Object.entries(monthly)
            .sort(([a], [b]) => b.localeCompare(a))
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
    }

    /**
     * Calculate equity curve data points
     */
    calculateEquityCurve(trades = this.trades, accounts = this.accounts) {
        // Get initial balance from accounts
        const initialBalance = accounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0) || 10000;

        // Sort trades by timestamp
        const sortedTrades = [...trades]
            .filter(t => t.profit !== undefined)
            .sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));

        const equityPoints = [{ date: 'Start', equity: initialBalance, profit: 0 }];
        let runningEquity = initialBalance;

        sortedTrades.forEach(trade => {
            runningEquity += trade.profit || 0;
            equityPoints.push({
                date: new Date(trade.timestamp || trade.createdAt).toLocaleDateString(),
                equity: runningEquity,
                profit: trade.profit || 0,
                tradeId: trade.id
            });
        });

        return equityPoints;
    }

    /**
     * Calculate maximum drawdown
     */
    calculateMaxDrawdown(equityCurve) {
        if (equityCurve.length < 2) return 0;

        let peak = equityCurve[0].equity;
        let maxDrawdown = 0;

        equityCurve.forEach(point => {
            if (point.equity > peak) {
                peak = point.equity;
            }
            const drawdown = ((peak - point.equity) / peak) * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        return maxDrawdown.toFixed(2);
    }

    /**
     * Get comprehensive analytics summary
     */
    async getAnalyticsSummary() {
        await this.init();

        const metrics = this.calculatePerformanceMetrics();
        const byStrategy = this.analyzeByStrategy();
        const bySession = this.analyzeBySession();
        const byPair = this.analyzeByPair();
        const monthly = this.analyzeMonthly();
        const equityCurve = this.calculateEquityCurve();
        const maxDrawdown = this.calculateMaxDrawdown(equityCurve);

        // Get all metadata fields and their analyses
        const metadataFields = this.getMetadataFields();
        const dynamicAnalysis = {};
        metadataFields.forEach(field => {
            dynamicAnalysis[field] = this.analyzeByField(field);
        });

        // Calculate average risk
        const activeTrades = this.trades.filter(t => t.status === 'active');
        const avgRisk = this.trades.length > 0
            ? this.trades.reduce((sum, t) => sum + parseFloat(t.riskPercent || 0), 0) / this.trades.length
            : 0;

        return {
            metrics,
            byStrategy,
            bySession,
            byPair,
            monthly,
            equityCurve,
            maxDrawdown,
            dynamicAnalysis,
            metadataFields,
            avgRisk: avgRisk.toFixed(2)
        };
    }

    /**
     * Generate analytics report
     */
    generateReport() {
        const summary = this.getAnalyticsSummary();

        return {
            generatedAt: new Date().toISOString(),
            totalTrades: this.trades.length,
            totalAccounts: this.accounts.length,
            ...summary
        };
    }
}

// Singleton instance
const analyticsEngine = new AnalyticsEngine();

if (typeof window !== 'undefined') {
    window.AnalyticsEngine = AnalyticsEngine;
    window.analyticsEngine = analyticsEngine;
}
