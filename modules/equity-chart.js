/**
 * Equity Curve Chart Module
 * Lightweight equity curve visualization with drawdown tracking
 */

class EquityChart {
    constructor() {
        this.chartInstances = {};
        this.colors = {
            primary: '#6366f1',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            accent: '#06b6d4'
        };
    }

    /**
     * Render equity curve chart
     * @param {string} containerId - DOM element ID
     * @param {array} data - Equity data points
     * @param {object} options - Chart options
     */
    async render(containerId, data, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        // Clear existing chart
        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex items-center justify-center h-full text-gray-500">
                    <p>No equity data available</p>
                </div>
            `;
            return;
        }

        // Create canvas for Chart.js
        const canvas = document.createElement('canvas');
        canvas.id = `${containerId}-canvas`;
        container.appendChild(canvas);

        // Prepare data
        const labels = data.map(d => d.date);
        const equityValues = data.map(d => d.equity);
        
        // Calculate drawdown
        const drawdownData = this.calculateDrawdown(equityValues);
        const peakData = this.calculatePeaks(equityValues);

        // Chart configuration
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Equity',
                        data: equityValues,
                        borderColor: this.colors.primary,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: this.colors.primary,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1
                    },
                    {
                        label: 'Peak',
                        data: peakData,
                        borderColor: this.colors.accent,
                        borderWidth: 1,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e4e4e7',
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 25, 0.95)',
                        titleColor: '#e4e4e7',
                        bodyColor: '#e4e4e7',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                return `${context.dataset.label}: $${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#a1a1aa',
                            font: {
                                size: 10
                            },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#a1a1aa',
                            font: {
                                size: 10
                            },
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                }
            }
        };

        // Add drawdown dataset if enabled
        if (options.showDrawdown !== false) {
            config.data.datasets.push({
                label: 'Drawdown %',
                data: drawdownData,
                borderColor: this.colors.danger,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 1,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                yAxisID: 'y1'
            });

            config.options.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false
                },
                ticks: {
                    color: this.colors.danger,
                    font: {
                        size: 10
                    },
                    callback: (value) => value.toFixed(1) + '%'
                },
                min: Math.min(...drawdownData, 0),
                max: 0
            };
        }

        // Load Chart.js if not already loaded
        await this.ensureChartJS();

        // Destroy existing chart
        if (this.chartInstances[containerId]) {
            this.chartInstances[containerId].destroy();
        }

        // Create new chart
        const ctx = canvas.getContext('2d');
        this.chartInstances[containerId] = new Chart(ctx, config);

        return this.chartInstances[containerId];
    }

    /**
     * Calculate drawdown percentage from equity values
     */
    calculateDrawdown(equityValues) {
        const drawdowns = [];
        let peak = equityValues[0];

        equityValues.forEach(value => {
            if (value > peak) {
                peak = value;
            }
            const drawdown = peak > 0 ? ((value - peak) / peak) * 100 : 0;
            drawdowns.push(drawdown);
        });

        return drawdowns;
    }

    /**
     * Calculate peak values
     */
    calculatePeaks(equityValues) {
        const peaks = [];
        let peak = equityValues[0];

        equityValues.forEach(value => {
            if (value > peak) {
                peak = value;
            }
            peaks.push(peak);
        });

        return peaks;
    }

    /**
     * Ensure Chart.js is loaded
     */
    ensureChartJS() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Update chart data
     */
    update(containerId, newData) {
        const chart = this.chartInstances[containerId];
        if (!chart) return;

        const labels = newData.map(d => d.date);
        const equityValues = newData.map(d => d.equity);
        const drawdownData = this.calculateDrawdown(equityValues);

        chart.data.labels = labels;
        chart.data.datasets[0].data = equityValues;
        
        if (chart.data.datasets[2]) {
            chart.data.datasets[2].data = drawdownData;
        }

        chart.update('none'); // Fast update without animation
    }

    /**
     * Destroy chart
     */
    destroy(containerId) {
        if (this.chartInstances[containerId]) {
            this.chartInstances[containerId].destroy();
            delete this.chartInstances[containerId];
        }
    }
}

// Singleton instance
const equityChart = new EquityChart();

if (typeof window !== 'undefined') {
    window.EquityChart = EquityChart;
    window.equityChart = equityChart;
}
