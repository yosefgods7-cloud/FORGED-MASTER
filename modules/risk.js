/**
 * Risk Engine Module
 * Calculates risk metrics, currency exposure, and generates warnings
 */

class RiskEngine {
    constructor() {
        this.settings = null;
    }

    async init() {
        this.settings = await storage.getSettings();
        return this;
    }

    /**
     * Calculate risk for a single trade
     */
    calculateTradeRisk(trade, accountBalance) {
        const entryPrice = parseFloat(trade.entryPrice) || 0;
        const stopLoss = parseFloat(trade.stopLoss) || 0;
        const lotSize = parseFloat(trade.lotSize) || 0;
        const direction = trade.direction || 'buy';

        if (!stopLoss || !entryPrice) {
            return {
                riskAmount: 0,
                riskPercent: 0,
                riskPerUnit: 0
            };
        }

        let riskPerUnit;
        if (direction === 'buy') {
            riskPerUnit = entryPrice - stopLoss;
        } else {
            riskPerUnit = stopLoss - entryPrice;
        }

        const riskAmount = Math.abs(riskPerUnit * lotSize * 100000);
        const riskPercent = accountBalance > 0 ? (riskAmount / accountBalance) * 100 : 0;

        return {
            riskAmount,
            riskPercent,
            riskPerUnit: Math.abs(riskPerUnit)
        };
    }

    /**
     * Calculate total open risk across all active trades
     */
    async calculateTotalOpenRisk(trades, accounts) {
        let totalRiskAmount = 0;
        let totalRiskPercent = 0;
        const accountMap = {};

        // Create account balance map
        accounts.forEach(acc => {
            accountMap[acc.id] = parseFloat(acc.balance) || 0;
        });

        // Sum up risk from active trades
        trades.filter(t => t.status === 'active').forEach(trade => {
            const accountBalance = accountMap[trade.accountId] || 10000;
            const risk = this.calculateTradeRisk(trade, accountBalance);
            totalRiskAmount += risk.riskAmount;
            
            const accountRiskPercent = (risk.riskAmount / accountBalance) * 100;
            totalRiskPercent += accountRiskPercent;
        });

        return {
            totalRiskAmount,
            totalRiskPercent: totalRiskPercent.toFixed(2),
            activeTradesCount: trades.filter(t => t.status === 'active').length
        };
    }

    /**
     * Calculate currency exposure from all active trades
     */
    calculateCurrencyExposure(trades) {
        const exposure = {};

        trades.filter(t => t.status === 'active').forEach(trade => {
            if (!trade.pair || trade.pair.length < 6) return;

            const baseCurrency = trade.pair.substring(0, 3);
            const quoteCurrency = trade.pair.substring(3, 6);
            const direction = trade.direction;
            const lotSize = parseFloat(trade.lotSize) || 0;

            // Initialize currencies if not exists
            if (!exposure[baseCurrency]) {
                exposure[baseCurrency] = { long: 0, short: 0, net: 0 };
            }
            if (!exposure[quoteCurrency]) {
                exposure[quoteCurrency] = { long: 0, short: 0, net: 0 };
            }

            // For BUY: Long base, Short quote
            // For SELL: Short base, Long quote
            if (direction === 'buy') {
                exposure[baseCurrency].long += lotSize;
                exposure[quoteCurrency].short += lotSize;
            } else {
                exposure[baseCurrency].short += lotSize;
                exposure[quoteCurrency].long += lotSize;
            }
        });

        // Calculate net exposure
        Object.keys(exposure).forEach(currency => {
            exposure[currency].net = exposure[currency].long - exposure[currency].short;
        });

        return exposure;
    }

    /**
     * Detect correlated exposure (risk stacking)
     */
    detectCorrelatedRisk(trades, currencyExposure) {
        const warnings = [];
        const threshold = 3.0; // Lots threshold for correlation warning

        // Check for high exposure in single currency
        Object.entries(currencyExposure).forEach(([currency, data]) => {
            const totalExposure = Math.abs(data.long) + Math.abs(data.short);
            if (totalExposure > threshold) {
                warnings.push({
                    type: 'correlation',
                    severity: 'warning',
                    message: `High ${currency} exposure: ${totalExposure.toFixed(2)} lots across ${data.long > 0 ? 'long' : ''}${data.long > 0 && data.short > 0 ? ' and ' : ''}${data.short > 0 ? 'short' : ''} positions`,
                    currency,
                    exposure: totalExposure
                });
            }
        });

        // Check for multiple trades on same pair
        const pairCounts = {};
        trades.filter(t => t.status === 'active').forEach(trade => {
            pairCounts[trade.pair] = (pairCounts[trade.pair] || 0) + 1;
        });

        Object.entries(pairCounts).forEach(([pair, count]) => {
            if (count > 1) {
                warnings.push({
                    type: 'duplicate',
                    severity: 'info',
                    message: `Multiple active trades on ${pair}: ${count} positions`,
                    pair,
                    count
                });
            }
        });

        return warnings;
    }

    /**
     * Generate risk warnings based on settings
     */
    async generateWarnings(trades, accounts) {
        const warnings = [];
        const settings = await storage.getSettings();
        const maxRiskPerTrade = parseFloat(settings.maxRiskPerTrade) || 2;
        const maxTotalRisk = parseFloat(settings.maxTotalRisk) || 6;

        // Get account balances
        const accountMap = {};
        accounts.forEach(acc => {
            accountMap[acc.id] = parseFloat(acc.balance) || 0;
        });

        // Check individual trade risk
        trades.filter(t => t.status === 'active').forEach(trade => {
            const accountBalance = accountMap[trade.accountId] || 10000;
            const risk = this.calculateTradeRisk(trade, accountBalance);

            if (risk.riskPercent > maxRiskPerTrade) {
                warnings.push({
                    type: 'risk_per_trade',
                    severity: 'danger',
                    message: `Trade on ${trade.pair} exceeds max risk: ${risk.riskPercent.toFixed(2)}% > ${maxRiskPerTrade}%`,
                    tradeId: trade.id,
                    riskPercent: risk.riskPercent
                });
            }
        });

        // Check total risk
        const totalRisk = await this.calculateTotalOpenRisk(trades, accounts);
        if (parseFloat(totalRisk.totalRiskPercent) > maxTotalRisk) {
            warnings.push({
                type: 'total_risk',
                severity: 'danger',
                message: `Total open risk exceeds limit: ${totalRisk.totalRiskPercent}% > ${maxTotalRisk}%`,
                totalRiskPercent: totalRisk.totalRiskPercent
            });
        }

        // Check currency correlation
        const currencyExposure = this.calculateCurrencyExposure(trades);
        const correlationWarnings = this.detectCorrelatedRisk(trades, currencyExposure);
        warnings.push(...correlationWarnings);

        return warnings;
    }

    /**
     * Calculate position size based on risk percentage
     */
    calculatePositionSize(entryPrice, stopLoss, accountBalance, riskPercent) {
        if (!entryPrice || !stopLoss || !accountBalance || !riskPercent) {
            return 0;
        }

        const riskAmount = accountBalance * (riskPercent / 100);
        const riskPerUnit = Math.abs(entryPrice - stopLoss);

        if (riskPerUnit === 0) return 0;

        // Standard lot = 100,000 units
        const lotSize = riskAmount / (riskPerUnit * 100000);
        return Math.round(lotSize * 100) / 100;
    }

    /**
     * Calculate R-multiple for a trade
     */
    calculateRMultiple(trade) {
        const riskPerUnit = trade.riskPerUnit || 0;
        const rewardPerUnit = trade.rewardPerUnit || 0;

        if (riskPerUnit === 0) return 0;

        return (rewardPerUnit / riskPerUnit).toFixed(2);
    }

    /**
     * Get risk metrics summary
     */
    async getRiskSummary(trades, accounts) {
        const totalRisk = await this.calculateTotalOpenRisk(trades, accounts);
        const currencyExposure = this.calculateCurrencyExposure(trades);
        const warnings = await this.generateWarnings(trades, accounts);

        // Calculate average risk per trade
        const activeTrades = trades.filter(t => t.status === 'active');
        const avgRisk = activeTrades.length > 0 
            ? (parseFloat(totalRisk.totalRiskPercent) / activeTrades.length).toFixed(2)
            : 0;

        return {
            totalRiskAmount: totalRisk.totalRiskAmount,
            totalRiskPercent: totalRisk.totalRiskPercent,
            activeTradesCount: totalRisk.activeTradesCount,
            averageRiskPerTrade: avgRisk,
            currencyExposure,
            warnings,
            warningsCount: warnings.length
        };
    }
}

// Singleton instance
const riskEngine = new RiskEngine();

if (typeof window !== 'undefined') {
    window.RiskEngine = RiskEngine;
    window.riskEngine = riskEngine;
}
