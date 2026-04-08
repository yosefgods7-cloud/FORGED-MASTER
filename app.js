/**
 * QUANT OS - Main Application
 * Professional Trading Operating System
 */

class QuantOS {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;

        try {
            // Initialize storage
            await storage.init();

            // Initialize UI
            await uiManager.init();

            // Register service worker for PWA
            this.registerServiceWorker();

            this.initialized = true;
            console.log('QUANT OS initialized successfully');
        } catch (error) {
            console.error('Failed to initialize QUANT OS:', error);
        }
    }

    /**
     * Register service worker
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }

    /**
     * Navigate between tabs
     */
    navigate(tab) {
        uiManager.navigate(tab);
    }

    /**
     * Open trade modal
     */
    async openTradeModal(tradeId = null) {
        uiManager.tags = [];
        uiManager.dynamicFields = [];
        uiManager.partials = [];

        // Reset form
        document.getElementById('tradeForm').reset();
        document.getElementById('tradeId').value = '';
        document.getElementById('tradeModalTitle').textContent = 'Add Trade';

        // Populate accounts
        await uiManager.populateAccountSelect('accountId');

        // Render empty states
        uiManager.renderTags();
        uiManager.renderDynamicFields();
        uiManager.renderPartials();

        // If editing, load trade data
        if (tradeId) {
            const trade = await storage.getTrade(tradeId);
            if (trade) {
                this.populateTradeForm(trade);
            }
        }

        uiManager.showModal('tradeModal');
    }

    /**
     * Populate trade form for editing
     */
    populateTradeForm(trade) {
        document.getElementById('tradeId').value = trade.id;
        document.getElementById('tradeModalTitle').textContent = 'Edit Trade';
        document.getElementById('pair').value = trade.pair || '';
        document.getElementById('direction').value = trade.direction || 'buy';
        document.getElementById('entryPrice').value = trade.entryPrice || '';
        document.getElementById('stopLoss').value = trade.stopLoss || '';
        document.getElementById('takeProfit').value = trade.takeProfit || '';
        document.getElementById('lotSize').value = trade.lotSize || '';
        document.getElementById('notes').value = trade.notes || '';

        // Populate account
        uiManager.populateAccountSelect('accountId', trade.accountId);

        // Populate tags from metadata
        if (trade.metadata && trade.metadata.tags) {
            uiManager.tags = [...trade.metadata.tags];
            uiManager.renderTags();
        }

        // Populate dynamic fields from metadata
        if (trade.metadata) {
            Object.entries(trade.metadata).forEach(([key, value]) => {
                if (key !== 'tags') {
                    uiManager.dynamicFields.push({
                        key,
                        value: Array.isArray(value) ? value.join(', ') : value
                    });
                }
            });
            uiManager.renderDynamicFields();
        }

        // Populate partials
        if (trade.partials && trade.partials.length > 0) {
            uiManager.partials = [...trade.partials];
            uiManager.renderPartials();
        }
    }

    /**
     * Close trade modal
     */
    closeTradeModal() {
        uiManager.hideModal('tradeModal');
    }

    /**
     * Save trade
     */
    async saveTrade() {
        const tradeId = document.getElementById('tradeId').value;
        
        const tradeData = {
            id: tradeId || null,
            pair: document.getElementById('pair').value,
            direction: document.getElementById('direction').value,
            entryPrice: document.getElementById('entryPrice').value,
            stopLoss: document.getElementById('stopLoss').value,
            takeProfit: document.getElementById('takeProfit').value,
            lotSize: document.getElementById('lotSize').value,
            accountId: document.getElementById('accountId').value,
            notes: document.getElementById('notes').value,
            dynamicFields: uiManager.dynamicFields,
            tags: uiManager.tags,
            partials: uiManager.partials
        };

        try {
            await journal.saveTrade(tradeData);
            this.closeTradeModal();
            await uiManager.refreshAll();
            
            // Show success message
            this.showToast(tradeId ? 'Trade updated successfully' : 'Trade created successfully');
        } catch (error) {
            console.error('Failed to save trade:', error);
            alert('Failed to save trade: ' + error.message);
        }
    }

    /**
     * Show trade detail modal
     */
    async showTradeDetail(tradeId) {
        const trade = await storage.getTrade(tradeId);
        if (!trade) return;

        const container = document.getElementById('tradeDetailContent');
        const isBuy = trade.direction === 'buy';
        const profitClass = trade.profit >= 0 ? 'text-success' : 'text-danger';
        const profitSign = trade.profit >= 0 ? '+' : '';

        // Build metadata HTML
        let metadataHtml = '';
        if (trade.metadata) {
            metadataHtml = Object.entries(trade.metadata).map(([key, value]) => {
                const displayValue = Array.isArray(value) ? value.join(', ') : value;
                return `
                    <div class="flex justify-between py-2 border-b border-gray-700">
                        <span class="text-gray-400 capitalize">${key.replace('_', ' ')}</span>
                        <span class="font-mono">${displayValue}</span>
                    </div>
                `;
            }).join('');
        }

        // Build partials HTML
        let partialsHtml = '';
        if (trade.partials && trade.partials.length > 0) {
            partialsHtml = trade.partials.map((p, i) => `
                <div class="glass-card p-3 mt-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Partial #${i + 1}</span>
                        <span>${p.percentage}% @ ${p.price}</span>
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-${isBuy ? 'success' : 'danger'}-500/20 to-${isBuy ? 'success' : 'danger'}-700/20 flex items-center justify-center">
                        <span class="font-bold text-${isBuy ? 'success' : 'danger'} text-lg">${trade.pair}</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="text-xl font-bold">${trade.pair}</h4>
                            <span class="badge badge-${trade.direction}">${trade.direction}</span>
                            <span class="badge badge-${trade.status}">${trade.status}</span>
                        </div>
                        <div class="text-sm text-gray-400">${new Date(trade.timestamp).toLocaleString()}</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="glass-card p-4">
                        <div class="text-sm text-gray-400">Entry Price</div>
                        <div class="font-mono text-lg">${trade.entryPrice}</div>
                    </div>
                    <div class="glass-card p-4">
                        <div class="text-sm text-gray-400">Current Price</div>
                        <div class="font-mono text-lg">${trade.currentPrice || trade.entryPrice}</div>
                    </div>
                    <div class="glass-card p-4">
                        <div class="text-sm text-gray-400">Stop Loss</div>
                        <div class="font-mono text-lg">${trade.stopLoss || '-'}</div>
                    </div>
                    <div class="glass-card p-4">
                        <div class="text-sm text-gray-400">Take Profit</div>
                        <div class="font-mono text-lg">${trade.takeProfit || '-'}</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="glass-card p-4">
                        <div class="text-sm text-gray-400">Lot Size</div>
                        <div class="font-mono text-lg">${trade.lotSize}</div>
                    </div>
                    <div class="glass-card p-4">
                        <div class="text-sm text-gray-400">R:R Ratio</div>
                        <div class="font-mono text-lg">${trade.rrRatio || '-'}</div>
                    </div>
                </div>

                <div class="glass-card p-4">
                    <div class="text-sm text-gray-400 mb-2">Profit/Loss</div>
                    <div class="stat-value ${profitClass}">${profitSign}$${(trade.profit || 0).toFixed(2)}</div>
                </div>

                ${partialsHtml ? `
                <div>
                    <div class="text-sm text-gray-400 mb-2">Partial Closes</div>
                    ${partialsHtml}
                </div>
                ` : ''}

                ${metadataHtml ? `
                <div class="glass-card p-4">
                    <div class="text-sm text-gray-400 mb-2">Metadata</div>
                    ${metadataHtml}
                </div>
                ` : ''}

                ${trade.notes ? `
                <div class="glass-card p-4">
                    <div class="text-sm text-gray-400 mb-2">Notes</div>
                    <p class="text-sm">${trade.notes}</p>
                </div>
                ` : ''}
            </div>
        `;

        // Setup action buttons
        document.getElementById('editTradeBtn').onclick = () => {
            this.closeTradeDetailModal();
            this.openTradeModal(tradeId);
        };

        document.getElementById('deleteTradeBtn').onclick = () => {
            if (confirm('Are you sure you want to delete this trade?')) {
                this.deleteTrade(tradeId);
            }
        };

        uiManager.showModal('tradeDetailModal');
    }

    /**
     * Close trade detail modal
     */
    closeTradeDetailModal() {
        uiManager.hideModal('tradeDetailModal');
    }

    /**
     * Delete trade
     */
    async deleteTrade(tradeId) {
        try {
            await journal.deleteTrade(tradeId);
            this.closeTradeDetailModal();
            await uiManager.refreshAll();
            this.showToast('Trade deleted successfully');
        } catch (error) {
            console.error('Failed to delete trade:', error);
            alert('Failed to delete trade: ' + error.message);
        }
    }

    /**
     * Open account modal
     */
    async openAccountModal(accountId = null) {
        document.getElementById('accountForm').reset();
        document.getElementById('accountIdEdit').value = '';
        document.getElementById('accountModalTitle').textContent = 'Add Account';

        if (accountId) {
            const account = await storage.getAccount(accountId);
            if (account) {
                document.getElementById('accountIdEdit').value = account.id;
                document.getElementById('accountName').value = account.name;
                document.getElementById('accountBalance').value = account.balance;
                document.getElementById('accountCurrency').value = account.currency || 'USD';
                document.getElementById('accountModalTitle').textContent = 'Edit Account';
            }
        }

        uiManager.showModal('accountModal');
    }

    /**
     * Close account modal
     */
    closeAccountModal() {
        uiManager.hideModal('accountModal');
    }

    /**
     * Edit account
     */
    editAccount(accountId) {
        this.openAccountModal(accountId);
    }

    /**
     * View account
     */
    async viewAccount(accountId) {
        const account = await storage.getAccount(accountId);
        if (!account) return;

        const trades = await storage.getTrades();
        const accountTrades = trades.filter(t => t.accountId === accountId);
        const activeTrades = accountTrades.filter(t => t.status === 'active');
        const closedTrades = accountTrades.filter(t => t.status === 'closed');

        const totalProfit = accountTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const unrealizedPnL = activeTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

        alert(`Account: ${account.name}\n` +
              `Balance: $${parseFloat(account.balance).toFixed(2)}\n` +
              `Equity: $${parseFloat(account.equity || account.balance).toFixed(2)}\n` +
              `Total Trades: ${accountTrades.length}\n` +
              `Active Trades: ${activeTrades.length}\n` +
              `Total P&L: $${totalProfit.toFixed(2)}\n` +
              `Unrealized P&L: $${unrealizedPnL.toFixed(2)}`);
    }

    /**
     * Save account
     */
    async saveAccount() {
        const accountId = document.getElementById('accountIdEdit').value;
        
        const accountData = {
            id: accountId || null,
            name: document.getElementById('accountName').value,
            balance: document.getElementById('accountBalance').value,
            currency: document.getElementById('accountCurrency').value
        };

        try {
            await portfolio.saveAccount(accountData);
            this.closeAccountModal();
            await uiManager.refreshAll();
            this.showToast(accountId ? 'Account updated successfully' : 'Account created successfully');
        } catch (error) {
            console.error('Failed to save account:', error);
            alert('Failed to save account: ' + error.message);
        }
    }

    /**
     * Open settings modal
     */
    async openSettingsModal() {
        const settings = await storage.getSettings();
        
        document.getElementById('maxRiskPerTrade').value = settings.maxRiskPerTrade || 2;
        document.getElementById('maxTotalRisk').value = settings.maxTotalRisk || 6;
        document.getElementById('defaultLotSize').value = settings.defaultLotSize || 1.0;

        uiManager.showModal('settingsModal');
    }

    /**
     * Close settings modal
     */
    closeSettingsModal() {
        uiManager.hideModal('settingsModal');
    }

    /**
     * Save settings
     */
    async saveSettings() {
        const settings = {
            maxRiskPerTrade: parseFloat(document.getElementById('maxRiskPerTrade').value) || 2,
            maxTotalRisk: parseFloat(document.getElementById('maxTotalRisk').value) || 6,
            defaultLotSize: parseFloat(document.getElementById('defaultLotSize').value) || 1.0
        };

        try {
            await storage.saveAllSettings(settings);
            this.closeSettingsModal();
            await uiManager.refreshAll();
            this.showToast('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings: ' + error.message);
        }
    }

    /**
     * Add dynamic field
     */
    addDynamicField() {
        uiManager.dynamicFields.push({ key: '', value: '' });
        uiManager.renderDynamicFields();
    }

    /**
     * Update dynamic field
     */
    updateDynamicField(index, field, value) {
        if (!uiManager.dynamicFields[index]) {
            uiManager.dynamicFields[index] = { key: '', value: '' };
        }
        uiManager.dynamicFields[index][field] = value;
    }

    /**
     * Remove dynamic field
     */
    removeDynamicField(index) {
        uiManager.dynamicFields.splice(index, 1);
        uiManager.renderDynamicFields();
    }

    /**
     * Add partial field
     */
    addPartialField() {
        uiManager.partials.push({ percentage: '', price: '' });
        uiManager.renderPartials();
    }

    /**
     * Update partial
     */
    updatePartial(index, field, value) {
        if (!uiManager.partials[index]) {
            uiManager.partials[index] = {};
        }
        uiManager.partials[index][field] = value;
    }

    /**
     * Remove partial
     */
    removePartial(index) {
        uiManager.partials.splice(index, 1);
        uiManager.renderPartials();
    }

    /**
     * Remove tag
     */
    removeTag(tag) {
        uiManager.tags = uiManager.tags.filter(t => t !== tag);
        uiManager.renderTags();
    }

    /**
     * Export data
     */
    async exportData() {
        try {
            const data = await storage.exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quant-os-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully');
        } catch (error) {
            console.error('Failed to export data:', error);
            alert('Failed to export data: ' + error.message);
        }
    }

    /**
     * Import data
     */
    async importData(input) {
        const file = input.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await storage.importAllData(data);
            await uiManager.refreshAll();
            this.showToast('Data imported successfully');
        } catch (error) {
            console.error('Failed to import data:', error);
            alert('Failed to import data: ' + error.message);
        }

        input.value = '';
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 glass-strong px-6 py-3 rounded-xl z-50 animate-fade-in';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Create global app instance
const app = new QuantOS();

// Initialize on DOM ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => app.init());
}

// Export for module usage
if (typeof window !== 'undefined') {
    window.QuantOS = QuantOS;
    window.app = app;
}
