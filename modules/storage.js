/**
 * Storage Module - IndexedDB Layer
 * Handles all database operations for trades, accounts, and settings
 */

const DB_NAME = 'QuantOS';
const DB_VERSION = 1;

const Stores = {
    TRADES: 'trades',
    ACCOUNTS: 'accounts',
    SETTINGS: 'settings'
};

class Storage {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create trades store
                if (!db.objectStoreNames.contains(Stores.TRADES)) {
                    const tradesStore = db.createObjectStore(Stores.TRADES, { keyPath: 'id' });
                    tradesStore.createIndex('accountId', 'accountId', { unique: false });
                    tradesStore.createIndex('pair', 'pair', { unique: false });
                    tradesStore.createIndex('direction', 'direction', { unique: false });
                    tradesStore.createIndex('status', 'status', { unique: false });
                    tradesStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create accounts store
                if (!db.objectStoreNames.contains(Stores.ACCOUNTS)) {
                    const accountsStore = db.createObjectStore(Stores.ACCOUNTS, { keyPath: 'id' });
                    accountsStore.createIndex('name', 'name', { unique: false });
                }

                // Create settings store
                if (!db.objectStoreNames.contains(Stores.SETTINGS)) {
                    db.createObjectStore(Stores.SETTINGS, { keyPath: 'key' });
                }
            };
        });
    }

    // Generic CRUD operations
    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async add(storeName, item) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, item) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Trade-specific operations
    async getTrades() {
        const trades = await this.getAll(Stores.TRADES);
        return trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async getTrade(id) {
        return this.getById(Stores.TRADES, id);
    }

    async saveTrade(trade) {
        if (!trade.id) {
            trade.id = this.generateId();
            trade.createdAt = new Date().toISOString();
        }
        trade.updatedAt = new Date().toISOString();
        
        // Calculate derived fields
        trade = this.calculateTradeFields(trade);
        
        await this.update(Stores.TRADES, trade);
        return trade;
    }

    async deleteTrade(id) {
        return this.delete(Stores.TRADES, id);
    }

    calculateTradeFields(trade) {
        // Determine status
        const hasPartialClose = trade.partials && trade.partials.length > 0;
        const totalClosed = trade.partials ? trade.partials.reduce((sum, p) => sum + (parseFloat(p.percentage) || 0), 0) : 0;
        
        if (totalClosed >= 100) {
            trade.status = 'closed';
        } else if (trade.entryPrice !== undefined && trade.entryPrice !== null) {
            trade.status = 'active';
        } else {
            trade.status = 'pending';
        }

        // Calculate profit/loss
        const entryPrice = parseFloat(trade.entryPrice) || 0;
        const currentPrice = trade.currentPrice || entryPrice;
        const stopLoss = parseFloat(trade.stopLoss) || 0;
        const takeProfit = parseFloat(trade.takeProfit) || 0;
        const lotSize = parseFloat(trade.lotSize) || 0;
        const direction = trade.direction || 'buy';

        // Calculate risk and reward
        let riskPerUnit = 0;
        let rewardPerUnit = 0;

        if (stopLoss) {
            if (direction === 'buy') {
                riskPerUnit = entryPrice - stopLoss;
            } else {
                riskPerUnit = stopLoss - entryPrice;
            }
        }

        if (takeProfit) {
            if (direction === 'buy') {
                rewardPerUnit = takeProfit - entryPrice;
            } else {
                rewardPerUnit = entryPrice - takeProfit;
            }
        }

        trade.riskPerUnit = riskPerUnit;
        trade.rewardPerUnit = rewardPerUnit;
        trade.rrRatio = riskPerUnit > 0 ? (rewardPerUnit / riskPerUnit).toFixed(2) : 0;

        // Calculate P&L based on partials
        let totalPnL = 0;
        let remainingPercentage = 100;

        if (trade.partials && trade.partials.length > 0) {
            trade.partials.forEach(partial => {
                const percentage = parseFloat(partial.percentage) || 0;
                const partialEntry = parseFloat(partial.entryPrice) || entryPrice;
                const partialExit = parseFloat(partial.price) || currentPrice;
                
                let pnl;
                if (direction === 'buy') {
                    pnl = (partialExit - partialEntry) * lotSize * (percentage / 100) * 100000;
                } else {
                    pnl = (partialEntry - partialExit) * lotSize * (percentage / 100) * 100000;
                }
                
                totalPnL += pnl;
                remainingPercentage -= percentage;
            });
        }

        // Add unrealized P&L for remaining position
        if (remainingPercentage > 0) {
            let unrealizedPnL;
            if (direction === 'buy') {
                unrealizedPnL = (currentPrice - entryPrice) * lotSize * (remainingPercentage / 100) * 100000;
            } else {
                unrealizedPnL = (entryPrice - currentPrice) * lotSize * (remainingPercentage / 100) * 100000;
            }
            totalPnL += unrealizedPnL;
        }

        trade.profit = totalPnL;
        trade.isWinner = totalPnL > 0;
        trade.isLoser = totalPnL < 0;

        // Calculate risk percentage
        const accountBalance = trade.accountBalance || 10000;
        const riskAmount = riskPerUnit * lotSize * 100000;
        trade.riskPercent = ((riskAmount / accountBalance) * 100).toFixed(2);

        // Extract currencies from pair
        if (trade.pair && trade.pair.length >= 6) {
            trade.baseCurrency = trade.pair.substring(0, 3);
            trade.quoteCurrency = trade.pair.substring(3, 6);
        }

        return trade;
    }

    // Account-specific operations
    async getAccounts() {
        return this.getAll(Stores.ACCOUNTS);
    }

    async getAccount(id) {
        return this.getById(Stores.ACCOUNTS, id);
    }

    async saveAccount(account) {
        if (!account.id) {
            account.id = this.generateId();
            account.createdAt = new Date().toISOString();
        }
        account.updatedAt = new Date().toISOString();
        await this.update(Stores.ACCOUNTS, account);
        return account;
    }

    async deleteAccount(id) {
        return this.delete(Stores.ACCOUNTS, id);
    }

    // Settings operations
    async getSettings() {
        const settings = await this.getAll(Stores.SETTINGS);
        const defaults = {
            maxRiskPerTrade: 2,
            maxTotalRisk: 6,
            defaultLotSize: 1.0,
            currency: 'USD'
        };

        const result = { ...defaults };
        settings.forEach(setting => {
            result[setting.key] = setting.value;
        });
        return result;
    }

    async saveSetting(key, value) {
        await this.update(Stores.SETTINGS, { key, value });
    }

    async saveAllSettings(settings) {
        const transaction = this.db.transaction([Stores.SETTINGS], 'readwrite');
        const store = transaction.objectStore(Stores.SETTINGS);
        
        for (const [key, value] of Object.entries(settings)) {
            store.put({ key, value });
        }
        
        return new Promise((resolve) => {
            transaction.oncomplete = () => resolve();
        });
    }

    // Export/Import
    async exportAllData() {
        const trades = await this.getTrades();
        const accounts = await this.getAccounts();
        const settings = await this.getSettings();

        return {
            version: DB_VERSION,
            exportedAt: new Date().toISOString(),
            data: {
                trades,
                accounts,
                settings
            }
        };
    }

    async importAllData(data) {
        if (!data || !data.data) {
            throw new Error('Invalid import data');
        }

        const { trades, accounts, settings } = data.data;

        // Clear existing data
        await this.clearAll();

        // Import accounts first
        if (accounts && Array.isArray(accounts)) {
            for (const account of accounts) {
                await this.saveAccount(account);
            }
        }

        // Import trades
        if (trades && Array.isArray(trades)) {
            for (const trade of trades) {
                await this.saveTrade(trade);
            }
        }

        // Import settings
        if (settings) {
            await this.saveAllSettings(settings);
        }

        return true;
    }

    async clearAll() {
        await this.init();
        
        const stores = [Stores.TRADES, Stores.ACCOUNTS, Stores.SETTINGS];
        
        for (const storeName of stores) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Singleton instance
const storage = new Storage();

if (typeof window !== 'undefined') {
    window.storage = storage;
    window.Stores = Stores;
}
