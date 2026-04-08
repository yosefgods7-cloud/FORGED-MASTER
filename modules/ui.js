/**
 * UI Module
 * Handles all UI rendering and interactions
 */

class UIManager {
    constructor() {
        this.currentTab = 'dashboard';
        this.tags = [];
        this.dynamicFields = [];
        this.partials = [];
    }

    /**
     * Initialize UI components
     */
    async init() {
        this.setupNavigation();
        this.setupModals();
        this.setupFormHandlers();
        await this.refreshAll();
    }

    /**
     * Setup navigation
     */
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;
                if (tab) {
                    app.navigate(tab);
                }
            });
        });

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => app.openSettingsModal());
        }
    }

    /**
     * Setup modal handlers
     */
    setupModals() {
        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        // Tag input handler
        const tagInput = document.getElementById('tagInput');
        if (tagInput) {
            tagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = tagInput.value.trim();
                    if (value && !this.tags.includes(value)) {
                        this.tags.push(value);
                        this.renderTags();
                        tagInput.value = '';
                    }
                }
            });
        }
    }

    /**
     * Setup form handlers
     */
    setupFormHandlers() {
        // Trade form
        const tradeForm = document.getElementById('tradeForm');
        if (tradeForm) {
            tradeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await app.saveTrade();
            });
        }

        // Account form
        const accountForm = document.getElementById('accountForm');
        if (accountForm) {
            accountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await app.saveAccount();
            });
        }
    }

    /**
     * Refresh all data and UI
     */
    async refreshAll() {
        await journal.init();
        await portfolio.init();
        await riskEngine.init();
        
        this.renderDashboard();
        this.renderJournal();
        this.renderPortfolio();
        this.renderAnalytics();
    }

    /**
     * Render dashboard
     */
    async renderDashboard() {
        const trades = await storage.getTrades();
        const accounts = await storage.getAccounts();
        const settings = await storage.getSettings();

        // Calculate metrics
        const totalBalance = accounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
        const totalEquity = accounts.reduce((sum, acc) => sum + (parseFloat(acc.equity) || parseFloat(acc.balance) || 0), 0);
        
        const closedTrades = trades.filter(t => t.status === 'closed');
        const winningTrades = closedTrades.filter(t => t.profit > 0).length;
        const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
        
        const activeTrades = trades.filter(t => t.status === 'active');
        const netProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
        
        const rrValues = trades.filter(t => t.rrRatio).map(t => parseFloat(t.rrRatio));
        const avgRR = rrValues.length > 0 ? rrValues.reduce((sum, r) => sum + r, 0) / rrValues.length : 0;

        // Calculate total risk
        let totalRiskPercent = 0;
        const accountMap = {};
        accounts.forEach(acc => {
            accountMap[acc.id] = parseFloat(acc.balance) || 10000;
        });

        activeTrades.forEach(trade => {
            const accountBalance = accountMap[trade.accountId] || 10000;
            if (trade.riskPerUnit && trade.lotSize) {
                const riskAmount = Math.abs(trade.riskPerUnit * trade.lotSize * 100000);
                totalRiskPercent += (riskAmount / accountBalance) * 100;
            }
        });

        // Update DOM
        document.getElementById('totalBalance').textContent = `$${totalBalance.toFixed(2)}`;
        document.getElementById('totalEquity').textContent = `$${totalEquity.toFixed(2)}`;
        document.getElementById('winRate').textContent = `${winRate.toFixed(1)}%`;
        document.getElementById('totalTrades').textContent = trades.length;
        document.getElementById('activeTrades').textContent = activeTrades.length;
        document.getElementById('netProfit').textContent = `$${netProfit.toFixed(2)}`;
        document.getElementById('avgRR').textContent = avgRR.toFixed(2);
        document.getElementById('totalRisk').textContent = `${totalRiskPercent.toFixed(1)}%`;

        // Render warnings
        this.renderWarnings(trades, accounts, settings);

        // Render equity curve
        this.renderEquityCurve(trades, accounts);

        // Render recent trades
        journal.renderRecentTrades(5);
    }

    /**
     * Render warnings
     */
    async renderWarnings(trades, accounts, settings) {
        const container = document.getElementById('warningsContainer');
        if (!container) return;

        const maxRiskPerTrade = parseFloat(settings.maxRiskPerTrade) || 2;
        const maxTotalRisk = parseFloat(settings.maxTotalRisk) || 6;

        const warnings = await riskEngine.generateWarnings(trades, accounts);

        if (warnings.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = warnings.map(warning => {
            const colors = {
                danger: 'border-danger bg-danger/10 text-danger',
                warning: 'border-warning bg-warning/10 text-warning',
                info: 'border-accent bg-accent/10 text-accent'
            };
            
            return `
                <div class="warning-banner ${colors[warning.severity] || colors.warning}">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <span>${warning.message}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Render equity curve chart
     */
    renderEquityCurve(trades, accounts) {
        const container = document.getElementById('equityChart');
        if (!container) return;

        const equityData = analyticsEngine.calculateEquityCurve(trades, accounts);
        
        if (equityData.length < 2) {
            container.innerHTML = '<p class="text-gray-400 text-center py-8">Not enough data for chart</p>';
            return;
        }

        // Simple SVG line chart
        const width = container.clientWidth || 600;
        const height = 200;
        const padding = 20;

        const minEquity = Math.min(...equityData.map(d => d.equity));
        const maxEquity = Math.max(...equityData.map(d => d.equity));
        const range = maxEquity - minEquity || 1;

        const points = equityData.map((d, i) => {
            const x = padding + (i / (equityData.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((d.equity - minEquity) / range) * (height - 2 * padding);
            return `${x},${y}`;
        }).join(' ');

        const isPositive = equityData[equityData.length - 1].equity >= equityData[0].equity;
        const gradientColor = isPositive ? '#10b981' : '#ef4444';

        container.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
                <defs>
                    <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:${gradientColor};stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:${gradientColor};stop-opacity:0" />
                    </linearGradient>
                </defs>
                
                <!-- Grid lines -->
                <line x1="${padding}" y1="${height/2}" x2="${width-padding}" y2="${height/2}" 
                      stroke="rgba(255,255,255,0.1)" stroke-dasharray="4"/>
                
                <!-- Area -->
                <polygon points="${padding},${height-padding} ${points} ${width-padding},${height-padding}" 
                         fill="url(#equityGradient)"/>
                
                <!-- Line -->
                <polyline points="${points}" fill="none" stroke="${gradientColor}" stroke-width="2"/>
                
                <!-- Start point -->
                <circle cx="${padding}" cy="${height - padding - ((equityData[0].equity - minEquity) / range) * (height - 2 * padding)}" 
                        r="4" fill="${gradientColor}"/>
                
                <!-- End point -->
                <circle cx="${width-padding}" cy="${height - padding - ((equityData[equityData.length-1].equity - minEquity) / range) * (height - 2 * padding)}" 
                        r="4" fill="${gradientColor}"/>
            </svg>
            <div class="flex justify-between text-xs text-gray-500 mt-2">
                <span>${equityData[0].date}</span>
                <span>${equityData[equityData.length-1].date}</span>
            </div>
        `;
    }

    /**
     * Render journal
     */
    renderJournal() {
        journal.renderTradesList();
    }

    /**
     * Render portfolio
     */
    async renderPortfolio() {
        portfolio.renderAccounts();
        
        const trades = await storage.getTrades();
        const activeTrades = trades.filter(t => t.status === 'active');
        const exposure = riskEngine.calculateCurrencyExposure(activeTrades);
        portfolio.renderCurrencyExposure(exposure);
    }

    /**
     * Render analytics
     */
    async renderAnalytics() {
        const summary = await analyticsEngine.getAnalyticsSummary();
        const m = summary.metrics;

        // Performance metrics
        document.getElementById('analyticsTotalTrades').textContent = m.totalTrades;
        document.getElementById('analyticsWinningTrades').textContent = m.winCount;
        document.getElementById('analyticsLosingTrades').textContent = m.lossCount;
        document.getElementById('analyticsWinRate').textContent = `${m.winRate}%`;
        document.getElementById('analyticsProfitFactor').textContent = m.profitFactor;
        document.getElementById('analyticsAvgWin').textContent = `$${m.avgWin.toFixed(2)}`;
        document.getElementById('analyticsAvgLoss').textContent = `$${m.avgLoss.toFixed(2)}`;

        // Risk metrics
        document.getElementById('analyticsAvgRR').textContent = m.avgRR;
        document.getElementById('analyticsBestTrade').textContent = `$${m.bestTrade.toFixed(2)}`;
        document.getElementById('analyticsWorstTrade').textContent = `$${m.worstTrade.toFixed(2)}`;
        document.getElementById('analyticsAvgRisk').textContent = `${summary.avgRisk}%`;
        document.getElementById('analyticsMaxDrawdown').textContent = `${summary.maxDrawdown}%`;

        // Dynamic analysis by metadata fields
        this.renderDynamicAnalysis(summary.dynamicAnalysis, summary.metadataFields);

        // Profit breakdowns
        this.renderProfitBreakdown('profitByStrategy', summary.byStrategy);
        this.renderProfitBreakdown('profitBySession', summary.bySession);
        this.renderProfitBreakdown('profitByPair', summary.byPair);
        this.renderProfitBreakdown('monthlyPerformance', summary.monthly);
    }

    /**
     * Render dynamic analysis section
     */
    renderDynamicAnalysis(dynamicAnalysis, metadataFields) {
        const container = document.getElementById('dynamicAnalysis');
        if (!container) return;

        if (metadataFields.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm">Add metadata fields to your trades to see dynamic analysis</p>';
            return;
        }

        container.innerHTML = metadataFields.slice(0, 5).map(field => {
            const data = dynamicAnalysis[field];
            if (!data || Object.keys(data).length === 0) return '';
            
            const topItem = Object.entries(data)[0];
            if (!topItem) return '';
            
            const [name, stats] = topItem;
            const profitClass = stats.profit >= 0 ? 'text-success' : 'text-danger';
            
            return `
                <div class="text-sm">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-400 capitalize">${field.replace('_', ' ')}</span>
                        <span class="${profitClass}">$${stats.profit.toFixed(2)}</span>
                    </div>
                    <div class="text-xs text-gray-500">${Object.keys(data).length} entries • Best: ${name}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render profit breakdown list
     */
    renderProfitBreakdown(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm">No data available</p>';
            return;
        }

        const items = Object.entries(data).slice(0, 10);
        const maxProfit = Math.max(...items.map(([, d]) => Math.abs(d.profit)));

        container.innerHTML = items.map(([name, stats]) => {
            const profitClass = stats.profit >= 0 ? 'text-success' : 'text-danger';
            const barWidth = maxProfit > 0 ? (Math.abs(stats.profit) / maxProfit) * 100 : 0;
            const barColor = stats.profit >= 0 ? 'bg-success' : 'bg-danger';
            
            return `
                <div class="relative">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="truncate max-w-[150px]">${name}</span>
                        <span class="${profitClass} font-mono">$${stats.profit.toFixed(2)}</span>
                    </div>
                    <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full ${barColor} rounded-full" style="width: ${barWidth}%"></div>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${stats.count} trades • ${stats.winRate}% win rate</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render tags
     */
    renderTags() {
        const container = document.getElementById('tagsContainer');
        if (!container) return;

        container.innerHTML = this.tags.map(tag => `
            <div class="tag">
                <span>${tag}</span>
                <span class="tag-remove" onclick="app.removeTag('${tag}')">×</span>
            </div>
        `).join('');
    }

    /**
     * Render dynamic fields
     */
    renderDynamicFields() {
        const container = document.getElementById('dynamicFields');
        if (!container) return;

        if (this.dynamicFields.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm italic">Click "Add Field" to add custom metadata</p>';
            return;
        }

        container.innerHTML = this.dynamicFields.map((field, index) => `
            <div class="dynamic-field-row">
                <input type="text" class="input-field text-sm" placeholder="Field name" 
                       value="${field.key || ''}" onchange="app.updateDynamicField(${index}, 'key', this.value)">
                <input type="text" class="input-field text-sm" placeholder="Value (comma-separated for arrays)" 
                       value="${field.value || ''}" onchange="app.updateDynamicField(${index}, 'value', this.value)">
                <button type="button" class="btn-secondary p-2" onclick="app.removeDynamicField(${index})">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    /**
     * Render partials
     */
    renderPartials() {
        const container = document.getElementById('partialsContainer');
        if (!container) return;

        if (this.partials.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm italic">No partial closes added</p>';
            return;
        }

        container.innerHTML = this.partials.map((partial, index) => `
            <div class="partial-item">
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="text-xs text-gray-400">Percentage</label>
                        <input type="number" class="input-field text-sm" placeholder="%" 
                               value="${partial.percentage || ''}" 
                               onchange="app.updatePartial(${index}, 'percentage', this.value)">
                    </div>
                    <div>
                        <label class="text-xs text-gray-400">Price</label>
                        <input type="number" step="0.00001" class="input-field text-sm" placeholder="Price" 
                               value="${partial.price || ''}" 
                               onchange="app.updatePartial(${index}, 'price', this.value)">
                    </div>
                    <div class="flex items-end">
                        <button type="button" class="btn-secondary w-full text-sm" onclick="app.removePartial(${index})">
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Populate account select
     */
    async populateAccountSelect(selectId, selectedId = null) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const accounts = await storage.getAccounts();
        
        if (accounts.length === 0) {
            select.innerHTML = '<option value="">No accounts - create one first</option>';
            return;
        }

        select.innerHTML = accounts.map(acc => 
            `<option value="${acc.id}" ${acc.id === selectedId ? 'selected' : ''}>${acc.name}</option>`
        ).join('');
    }

    /**
     * Show/hide modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Navigate between tabs
     */
    navigate(tab) {
        this.currentTab = tab;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tab);
        });

        // Refresh data when navigating
        if (tab === 'dashboard') {
            this.renderDashboard();
        } else if (tab === 'journal') {
            this.renderJournal();
        } else if (tab === 'portfolio') {
            this.renderPortfolio();
        } else if (tab === 'analytics') {
            this.renderAnalytics();
        }
    }
}

// Singleton instance
const uiManager = new UIManager();

if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    window.uiManager = uiManager;
}
