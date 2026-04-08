/**
 * AI Economic Calendar Module - Gemini Integration
 * Fetches and analyzes Forex Factory news using Google Gemini AI
 */

class AICalendar {
    constructor() {
        this.apiKey = null;
        this.cacheKey = 'ai_calendar_cache';
        this.pairCurrencyMap = {
            'EURUSD': ['EUR', 'USD'],
            'GBPUSD': ['GBP', 'USD'],
            'USDJPY': ['USD', 'JPY'],
            'GBPJPY': ['GBP', 'JPY'],
            'EURJPY': ['EUR', 'JPY'],
            'AUDUSD': ['AUD', 'USD'],
            'USDCAD': ['USD', 'CAD'],
            'NZDUSD': ['NZD', 'USD'],
            'EURGBP': ['EUR', 'GBP'],
            'XAUUSD': ['XAU', 'USD'],
            'XAGUSD': ['XAG', 'USD'],
            'USOIL': ['USD'],
            'BTCUSD': ['BTC', 'USD'],
            'ETHUSD': ['ETH', 'USD']
        };
    }

    async init() {
        const settings = await storage.getSettings();
        this.apiKey = settings.geminiApiKey || null;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    /**
     * Map trading pairs to currencies
     */
    getRelevantCurrencies(pairs) {
        const currencies = new Set();
        pairs.forEach(pair => {
            const mapped = this.pairCurrencyMap[pair.toUpperCase()] || [];
            mapped.forEach(c => currencies.add(c));
        });
        return Array.from(currencies);
    }

    /**
     * Fetch Forex Factory news (simulated - actual scraping requires backend)
     * In production, this would call a backend proxy service
     */
    async fetchForexFactoryNews() {
        // Note: Direct browser-based scraping of Forex Factory is blocked by CORS
        // This module provides the structure; in production, use a backend proxy
        
        // For demo purposes, we'll create sample news data
        // In real implementation, this would fetch from your backend API
        const today = new Date().toISOString().split('T')[0];
        
        const sampleNews = [
            {
                time: '08:30',
                currency: 'USD',
                impact: 'high',
                event: 'Non-Farm Payrolls',
                actual: '',
                forecast: '185K',
                previous: '216K'
            },
            {
                time: '08:30',
                currency: 'USD',
                impact: 'high',
                event: 'Unemployment Rate',
                actual: '',
                forecast: '3.8%',
                previous: '3.7%'
            },
            {
                time: '10:00',
                currency: 'USD',
                impact: 'medium',
                event: 'ISM Manufacturing PMI',
                actual: '',
                forecast: '47.5',
                previous: '47.4'
            },
            {
                time: '14:00',
                currency: 'USD',
                impact: 'high',
                event: 'Fed Chair Powell Speech',
                actual: '',
                forecast: '',
                previous: ''
            },
            {
                time: '04:00',
                currency: 'EUR',
                impact: 'medium',
                event: 'ECB President Lagarde Speech',
                actual: '',
                forecast: '',
                previous: ''
            },
            {
                time: '02:00',
                currency: 'GBP',
                impact: 'high',
                event: 'BoE Interest Rate Decision',
                actual: '',
                forecast: '5.25%',
                previous: '5.25%'
            },
            {
                time: '19:50',
                currency: 'JPY',
                impact: 'medium',
                event: 'BoJ Core CPI YoY',
                actual: '',
                forecast: '2.8%',
                previous: '2.9%'
            }
        ];

        return sampleNews;
    }

    /**
     * Filter news by relevant currencies
     */
    filterNewsByCurrencies(news, currencies) {
        if (!currencies || currencies.length === 0) {
            return news;
        }
        return news.filter(item => currencies.includes(item.currency));
    }

    /**
     * Call Gemini API for news analysis
     */
    async analyzeWithGemini(news, selectedPairs) {
        if (!this.apiKey) {
            throw new Error('Gemini API key not configured');
        }

        const currencies = this.getRelevantCurrencies(selectedPairs);
        const filteredNews = this.filterNewsByCurrencies(news, currencies);

        const prompt = `You are a professional forex trading analyst. Analyze the following economic news events for trading relevance.

Selected Trading Pairs: ${selectedPairs.join(', ')}
Relevant Currencies: ${currencies.join(', ')}

News Events:
${filteredNews.map(n => `- ${n.time} ${n.currency} [${n.impact.toUpperCase()}] ${n.event}`).join('\n')}

Provide analysis in JSON format with these fields:
{
    "riskLevel": "LOW" | "MEDIUM" | "HIGH",
    "summary": "Brief summary of market conditions",
    "highRiskSessions": ["list of high risk time windows"],
    "safeWindows": ["list of safe trading windows"],
    "avoidTradingTimes": ["times to avoid trading"],
    "pairSpecificRisks": {
        "PAIR": "specific risk note for each pair"
    },
    "recommendations": ["list of actionable recommendations"]
}`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1024
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            // Parse JSON from response
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Failed to parse Gemini response');
        } catch (error) {
            console.error('Gemini analysis failed:', error);
            throw error;
        }
    }

    /**
     * Get cached analysis for today
     */
    getCachedAnalysis(date = new Date()) {
        const dateKey = date.toISOString().split('T')[0];
        const cache = localStorage.getItem(this.cacheKey);
        
        if (cache) {
            const parsed = JSON.parse(cache);
            if (parsed.date === dateKey) {
                return parsed.data;
            }
        }
        return null;
    }

    /**
     * Cache analysis result
     */
    cacheAnalysis(analysis, date = new Date()) {
        const dateKey = date.toISOString().split('T')[0];
        localStorage.setItem(this.cacheKey, JSON.stringify({
            date: dateKey,
            timestamp: Date.now(),
            data: analysis
        }));
    }

    /**
     * Main method to get AI-powered calendar analysis
     */
    async getAnalysis(selectedPairs = []) {
        await this.init();

        // Check cache first
        const cached = this.getCachedAnalysis();
        if (cached && cached.pairs?.every(p => selectedPairs.includes(p))) {
            return cached;
        }

        // If no API key, return basic filtered news
        if (!this.apiKey) {
            const news = await this.fetchForexFactoryNews();
            const currencies = this.getRelevantCurrencies(selectedPairs);
            const filtered = this.filterNewsByCurrencies(news, currencies);
            
            return {
                news: filtered,
                riskLevel: 'UNKNOWN',
                summary: 'Configure Gemini API key in Settings for AI analysis',
                highRiskSessions: [],
                safeWindows: [],
                avoidTradingTimes: [],
                pairSpecificRisks: {},
                recommendations: ['Add your Gemini API key in Settings for intelligent analysis']
            };
        }

        try {
            // Fetch news
            const news = await this.fetchForexFactoryNews();
            
            // Analyze with Gemini
            const analysis = await this.analyzeWithGemini(news, selectedPairs);
            
            // Combine results
            const result = {
                date: new Date().toISOString().split('T')[0],
                pairs: selectedPairs,
                news: this.filterNewsByCurrencies(news, this.getRelevantCurrencies(selectedPairs)),
                ...analysis
            };

            // Cache the result
            this.cacheAnalysis(result);

            return result;
        } catch (error) {
            console.error('AI Calendar analysis failed:', error);
            return {
                news: await this.fetchForexFactoryNews(),
                riskLevel: 'ERROR',
                summary: `Analysis failed: ${error.message}`,
                highRiskSessions: [],
                safeWindows: [],
                avoidTradingTimes: [],
                pairSpecificRisks: {},
                recommendations: ['Check your internet connection and API key']
            };
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        localStorage.removeItem(this.cacheKey);
    }
}

// Singleton instance
const aiCalendar = new AICalendar();

if (typeof window !== 'undefined') {
    window.AICalendar = AICalendar;
    window.aiCalendar = aiCalendar;
}
