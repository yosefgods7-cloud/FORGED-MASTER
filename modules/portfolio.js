/**
 * Portfolio Module
 * Handles accounts management and portfolio analytics
 */

class Portfolio {
    constructor() {
        this.accounts = [];
        this.trades = [];
    }

    async init() {
        await this.loadAccounts();
        return this;
    }

    async loadAccounts() {
        this.accounts = await storage.getAccounts();
        return this.accounts;
    }

    /**
     * Create or update an account
     */
    async saveAccount(accountData) {
        const account = {
            name: accountData.name,
            balance: parseFloat(accountData.balance),
            currency: accountData.currency || 'USD'
        };

        if (accountData.id) {
            account.id = accountData.id;
        }

        // Calculate equity from active trades
        await this.updateAccountEquity(account);

        const savedAccount = await storage.saveAccount(account);
        await this.loadAccounts();
        return savedAccount;
    }

    /**
     * Delete an account
     */
    async deleteAccount(id) {
        await storage.deleteAccount(id);
        await this.loadAccounts();
    }

    /**
     * Get account by ID
     */
    async getAccount(id) {
        return await storage.getAccount(id);
    }

    /**
     * Update account equity based on active trades
     */
    async updateAccountEquity(account) {
        const activeTrades = this.trades.filter(t => t.accountId === account.id && t.status === 'active');
        
        const unrealizedPnL = activeTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
        
        account.equity = (parseFloat(account.balance) || 0) + unrealizedPnL;
        account.unrealizedPnL = unrealizedPnL;
        account.activeTradesCount = activeTrades.length;
        
        return account;
    }

    /**
     * Get total portfolio value
     */
    getTotalPortfolioValue() {
        return this.accounts.reduce((sum, acc) => sum + (parseFloat(acc.equity) || parseFloat(acc.balance) || 0), 0);
    }

    /**
     * Get total balance across all accounts
     */
    getTotalBalance() {
        return this.accounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
    }

    /**
     * Get total equity across all accounts
     */
    getTotalEquity() {
        return this.accounts.reduce((sum, acc) => sum + (parseFloat(acc.equity) || parseFloat(acc.balance) || 0), 0);
    }

    /**
     * Render accounts list
     */
    renderAccounts(containerId = 'accountsList') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.accounts.length === 0) {
            container.innerHTML = `
                <div class="glass-card p-8 text-center col-span-full">
                    <p class="text-gray-400 mb-4">No accounts yet</p>
                    <button class="btn-primary" onclick="app.openAccountModal()">Create Your First Account</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.accounts.map(account => this.renderAccountCard(account)).join('');
    }

    /**
     * Render a single account card
     */
    renderAccountCard(account) {
        const balance = parseFloat(account.balance) || 0;
        const equity = parseFloat(account.equity) || balance;
        const unrealizedPnL = equity - balance;
        const pnlClass = unrealizedPnL >= 0 ? 'text-success' : 'text-danger';
        const pnlSign = unrealizedPnL >= 0 ? '+' : '';

        return `
            <div class="glass-card p-6" data-account-id="${account.id}">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">${account.name}</h3>
                    <span class="badge badge-active">${account.currency || 'USD'}</span>
                </div>
                
                <div class="space-y-3">
                    <div>
                        <div class="text-sm text-gray-400">Balance</div>
                        <div class="stat-value text-primary">$${balance.toFixed(2)}</div>
                    </div>
                    
                    <div>
                        <div class="text-sm text-gray-400">Equity</div>
                        <div class="stat-value text-accent">$${equity.toFixed(2)}</div>
                    </div>
                    
                    ${unrealizedPnL !== 0 ? `
                    <div>
                        <div class="text-sm text-gray-400">Unrealized P&L</div>
                        <div class="stat-value ${pnlClass}">${pnlSign}$${unrealizedPnL.toFixed(2)}</div>
                    </div>
                    ` : ''}
                    
                    <div class="pt-3 border-t border-gray-700">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-400">Active Trades</span>
                            <span>${account.activeTradesCount || 0}</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-700">
                    <button class="btn-secondary flex-1 text-sm" onclick="app.editAccount('${account.id}')">Edit</button>
                    <button class="btn-secondary flex-1 text-sm" onclick="app.viewAccount('${account.id}')">View</button>
                </div>
            </div>
        `;
    }

    /**
     * Render currency exposure
     */
    renderCurrencyExposure(exposure, containerId = 'currencyExposure') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!exposure || Object.keys(exposure).length === 0) {
            container.innerHTML = '<p class="text-gray-400 col-span-full">No active positions</p>';
            return;
        }

        container.innerHTML = Object.entries(exposure).map(([currency, data]) => {
            const netClass = data.net >= 0 ? 'text-success' : 'text-danger';
            const netSign = data.net >= 0 ? '+' : '';
            
            return `
                <div class="glass-card p-4">
                    <div class="font-bold text-lg mb-2">${currency}</div>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Long</span>
                            <span class="text-success">${data.long.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Short</span>
                            <span class="text-danger">${data.short.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between pt-2 border-t border-gray-700">
                            <span class="text-gray-400">Net</span>
                            <span class="${netClass}">${netSign}${data.net.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Get portfolio summary
     */
    async getPortfolioSummary() {
        this.trades = await storage.getTrades();
        
        // Update all accounts with current equity
        for (const account of this.accounts) {
            await this.updateAccountEquity(account);
        }

        const totalBalance = this.getTotalBalance();
        const totalEquity = this.getTotalEquity();
        const totalUnrealizedPnL = totalEquity - totalBalance;
        
        const activeTrades = this.trades.filter(t => t.status === 'active');
        const closedTrades = this.trades.filter(t => t.status === 'closed');
        
        const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const winningTrades = closedTrades.filter(t => t.profit > 0).length;
        const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

        return {
            totalBalance,
            totalEquity,
            totalUnrealizedPnL,
            totalProfit,
            accountsCount: this.accounts.length,
            totalTrades: this.trades.length,
            activeTradesCount: activeTrades.length,
            closedTradesCount: closedTrades.length,
            winRate: winRate.toFixed(2),
            accounts: this.accounts
        };
    }
}

// Singleton instance
const portfolio = new Portfolio();

if (typeof window !== 'undefined') {
    window.Portfolio = Portfolio;
    window.portfolio = portfolio;
}
