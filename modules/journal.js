/**
 * Journal Module
 * Handles trade CRUD operations and rendering
 */

class Journal {
    constructor() {
        this.trades = [];
        this.filteredTrades = [];
    }

    async init() {
        await this.loadTrades();
        return this;
    }

    async loadTrades() {
        this.trades = await storage.getTrades();
        this.filteredTrades = [...this.trades];
        return this.trades;
    }

    /**
     * Create or update a trade
     */
    async saveTrade(tradeData) {
        // Process metadata from dynamic fields
        const metadata = {};
        if (tradeData.dynamicFields) {
            tradeData.dynamicFields.forEach(field => {
                if (field.key && field.value) {
                    // Handle array values (comma-separated)
                    if (field.value.includes(',')) {
                        metadata[field.key] = field.value.split(',').map(v => v.trim()).filter(v => v);
                    } else {
                        metadata[field.key] = field.value;
                    }
                }
            });
        }

        // Process tags
        if (tradeData.tags && tradeData.tags.length > 0) {
            metadata.tags = tradeData.tags;
        }

        // Get account balance for risk calculation
        const account = await storage.getAccount(tradeData.accountId);
        if (account) {
            tradeData.accountBalance = parseFloat(account.balance) || 10000;
            tradeData.accountName = account.name;
        }

        // Build trade object
        const trade = {
            pair: tradeData.pair.toUpperCase(),
            direction: tradeData.direction,
            entryPrice: parseFloat(tradeData.entryPrice),
            stopLoss: tradeData.stopLoss ? parseFloat(tradeData.stopLoss) : null,
            takeProfit: tradeData.takeProfit ? parseFloat(tradeData.takeProfit) : null,
            lotSize: parseFloat(tradeData.lotSize),
            accountId: tradeData.accountId,
            timestamp: tradeData.timestamp || new Date().toISOString(),
            notes: tradeData.notes || '',
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            partials: tradeData.partials || []
        };

        // Add ID if editing
        if (tradeData.id) {
            trade.id = tradeData.id;
        }

        // Set current price for active trades
        if (!trade.currentPrice) {
            trade.currentPrice = trade.entryPrice;
        }

        const savedTrade = await storage.saveTrade(trade);
        await this.loadTrades();
        return savedTrade;
    }

    /**
     * Delete a trade
     */
    async deleteTrade(id) {
        await storage.deleteTrade(id);
        await this.loadTrades();
    }

    /**
     * Get a single trade by ID
     */
    async getTrade(id) {
        return await storage.getTrade(id);
    }

    /**
     * Filter trades
     */
    filterTrades(filters = {}) {
        this.filteredTrades = this.trades.filter(trade => {
            if (filters.pair && !trade.pair.toLowerCase().includes(filters.pair.toLowerCase())) {
                return false;
            }
            if (filters.direction && trade.direction !== filters.direction) {
                return false;
            }
            if (filters.status && trade.status !== filters.status) {
                return false;
            }
            return true;
        });
        return this.filteredTrades;
    }

    /**
     * Get active trades
     */
    getActiveTrades() {
        return this.trades.filter(t => t.status === 'active');
    }

    /**
     * Get closed trades
     */
    getClosedTrades() {
        return this.trades.filter(t => t.status === 'closed');
    }

    /**
     * Update trade with partial close
     */
    async addPartialClose(tradeId, partialData) {
        const trade = await this.getTrade(tradeId);
        if (!trade) throw new Error('Trade not found');

        if (!trade.partials) {
            trade.partials = [];
        }

        // Add entry price to partial if not provided
        if (!partialData.entryPrice) {
            partialData.entryPrice = trade.entryPrice;
        }

        // Add timestamp
        partialData.timestamp = new Date().toISOString();

        trade.partials.push(partialData);

        // Update current price
        if (partialData.price) {
            trade.currentPrice = parseFloat(partialData.price);
        }

        return await storage.saveTrade(trade);
    }

    /**
     * Close a trade completely
     */
    async closeTrade(tradeId, closePrice) {
        const trade = await this.getTrade(tradeId);
        if (!trade) throw new Error('Trade not found');

        // Calculate remaining percentage
        const totalClosed = trade.partials 
            ? trade.partials.reduce((sum, p) => sum + (parseFloat(p.percentage) || 0), 0)
            : 0;
        
        const remainingPercentage = 100 - totalClosed;

        if (remainingPercentage > 0) {
            // Add final partial for remaining position
            await this.addPartialClose(tradeId, {
                percentage: remainingPercentage,
                price: closePrice,
                entryPrice: trade.entryPrice
            });
        }

        await this.loadTrades();
        return await this.getTrade(tradeId);
    }

    /**
     * Render trades list HTML
     */
    renderTradesList(trades = this.filteredTrades, containerId = 'tradesList') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (trades.length === 0) {
            container.innerHTML = `
                <div class="glass-card p-8 text-center">
                    <p class="text-gray-400 mb-4">No trades found</p>
                    <button class="btn-primary" onclick="app.openTradeModal()">Add Your First Trade</button>
                </div>
            `;
            return;
        }

        container.innerHTML = trades.map(trade => this.renderTradeCard(trade)).join('');

        // Add click handlers
        container.querySelectorAll('.trade-card').forEach(card => {
            card.addEventListener('click', () => {
                app.showTradeDetail(card.dataset.tradeId);
            });
        });
    }

    /**
     * Render a single trade card
     */
    renderTradeCard(trade) {
        const isBuy = trade.direction === 'buy';
        const profitClass = trade.profit >= 0 ? 'text-success' : 'text-danger';
        const profitSign = trade.profit >= 0 ? '+' : '';
        const statusBadge = trade.status === 'active' 
            ? '<span class="badge badge-active">Active</span>'
            : '<span class="badge badge-closed">Closed</span>';

        // Format metadata preview
        let metadataPreview = '';
        if (trade.metadata) {
            const items = [];
            if (trade.metadata.strategy) items.push(trade.metadata.strategy);
            if (trade.metadata.session) items.push(trade.metadata.session);
            if (trade.metadata.timeframe) items.push(trade.metadata.timeframe);
            if (items.length > 0) {
                metadataPreview = `<div class="text-xs text-gray-500 mt-2">${items.join(' • ')}</div>`;
            }
        }

        // Partials indicator
        let partialsIndicator = '';
        if (trade.partials && trade.partials.length > 0) {
            const totalClosed = trade.partials.reduce((sum, p) => sum + (parseFloat(p.percentage) || 0), 0);
            partialsIndicator = `<div class="text-xs text-accent mt-1">${totalClosed.toFixed(0)}% closed</div>`;
        }

        return `
            <div class="glass-card trade-card ${trade.direction}" data-trade-id="${trade.id}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-${isBuy ? 'success' : 'danger'}-500/20 to-${isBuy ? 'success' : 'danger'}-700/20 flex items-center justify-center">
                            <span class="font-bold text-${isBuy ? 'success' : 'danger'} text-sm">${trade.pair}</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-semibold">${trade.pair}</span>
                                <span class="badge badge-${trade.direction}">${trade.direction}</span>
                                ${statusBadge}
                            </div>
                            <div class="text-sm text-gray-400">${new Date(trade.timestamp).toLocaleDateString()}</div>
                            ${metadataPreview}
                            ${partialsIndicator}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="stat-value ${profitClass}">${profitSign}$${(trade.profit || 0).toFixed(2)}</div>
                        <div class="text-xs text-gray-500">${trade.lotSize} lots</div>
                        ${trade.rrRatio ? `<div class="text-xs text-gray-500">R:R ${trade.rrRatio}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recent trades for dashboard
     */
    renderRecentTrades(limit = 5) {
        const recent = this.trades.slice(0, limit);
        this.renderTradesList(recent, 'recentTradesList');
    }
}

// Singleton instance
const journal = new Journal();

if (typeof window !== 'undefined') {
    window.Journal = Journal;
    window.journal = journal;
}
