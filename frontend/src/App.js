import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  BarChart3,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Database,
  Zap
} from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Stock Sidebar Component
const StockSidebar = ({ stocks, selectedStock, onSelectStock, loading }) => {
  return (
    <aside className="w-64 bg-terminal-surface border-r border-terminal-border h-full overflow-y-auto" data-testid="stock-sidebar">
      <div className="p-4 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-terminal-blue" />
          <h2 className="text-lg font-semibold text-terminal-text">Watchlist</h2>
        </div>
        <p className="text-xs text-terminal-muted mt-1">NIFTY50 Stocks</p>
      </div>
      
      <div className="p-2">
        {stocks.map((stock) => (
          <button
            key={stock.ticker}
            onClick={() => onSelectStock(stock.ticker)}
            disabled={loading}
            data-testid={`stock-btn-${stock.ticker}`}
            className={`stock-card w-full p-3 rounded-lg mb-2 text-left border transition-all ${
              selectedStock === stock.ticker
                ? 'active border-terminal-blue bg-terminal-blue/10'
                : 'border-terminal-border hover:border-terminal-muted bg-terminal-bg/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-terminal-text text-sm">
                {stock.ticker.replace('.NS', '')}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-terminal-border text-terminal-muted">
                {stock.sector}
              </span>
            </div>
            <p className="text-xs text-terminal-muted mt-1 truncate">{stock.name}</p>
          </button>
        ))}
      </div>
    </aside>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, subtitle, icon: Icon, color, trend }) => {
  const colorClasses = {
    green: 'text-terminal-green border-terminal-green/30 bg-terminal-green/10',
    red: 'text-terminal-red border-terminal-red/30 bg-terminal-red/10',
    blue: 'text-terminal-blue border-terminal-blue/30 bg-terminal-blue/10',
    orange: 'text-terminal-orange border-terminal-orange/30 bg-terminal-orange/10',
    purple: 'text-terminal-purple border-terminal-purple/30 bg-terminal-purple/10'
  };

  return (
    <div className={`metric-card p-4 rounded-xl border ${colorClasses[color]} backdrop-blur-sm`} data-testid={`metric-${title.toLowerCase().replace(' ', '-')}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-terminal-muted uppercase tracking-wider">{title}</span>
        <Icon className={`w-4 h-4 ${color === 'green' ? 'text-terminal-green' : color === 'red' ? 'text-terminal-red' : color === 'blue' ? 'text-terminal-blue' : color === 'orange' ? 'text-terminal-orange' : 'text-terminal-purple'}`} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-terminal-text">{value}</span>
        {trend !== undefined && (
          <span className={`flex items-center text-xs ${trend >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(2)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-terminal-muted mt-1">{subtitle}</p>}
    </div>
  );
};

// Stock Chart Component
const StockChart = ({ data, stockName }) => {
  // Format data for chart
  const chartData = data.map((point, index) => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    index
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-terminal-surface border border-terminal-border p-3 rounded-lg shadow-xl">
          <p className="text-terminal-muted text-xs mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-terminal-muted">{entry.name}:</span>
              <span className="font-semibold text-terminal-text">₹{entry.value?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container p-6 rounded-xl border border-terminal-border" data-testid="stock-chart">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-terminal-text">{stockName} Price Chart</h3>
          <p className="text-xs text-terminal-muted">Price vs 5-Period SMA (1-minute intervals)</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-terminal-green"></span>
            <span className="text-terminal-muted">Actual Price</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-terminal-orange"></span>
            <span className="text-terminal-muted">SMA Trend</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis 
            dataKey="time" 
            stroke="#8b949e" 
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#8b949e" 
            tick={{ fontSize: 10 }}
            domain={['auto', 'auto']}
            tickFormatter={(value) => `₹${value.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="close"
            name="Actual Price"
            stroke="#3fb950"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3fb950' }}
          />
          <Line
            type="monotone"
            dataKey="sma_5"
            name="SMA Trend"
            stroke="#d29922"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
            activeDot={{ r: 4, fill: '#d29922' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Data Table Component
const DataTable = ({ data }) => {
  // Get last 10 data points
  const tableData = data.slice(-10).reverse();

  const getSignalClass = (signal) => {
    switch (signal) {
      case 'BUY': return 'signal-badge signal-buy';
      case 'SELL': return 'signal-badge signal-sell';
      case 'HOLD': return 'signal-badge signal-hold';
      default: return 'signal-badge signal-wait';
    }
  };

  return (
    <div className="bg-terminal-surface rounded-xl border border-terminal-border overflow-hidden" data-testid="data-table">
      <div className="p-4 border-b border-terminal-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-terminal-purple" />
          <h3 className="text-lg font-semibold text-terminal-text">Live Data Feed</h3>
        </div>
        <span className="text-xs text-terminal-muted">Last 10 data points</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-terminal-bg/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-terminal-muted uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-terminal-muted uppercase tracking-wider">Open</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-terminal-muted uppercase tracking-wider">High</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-terminal-muted uppercase tracking-wider">Low</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-terminal-muted uppercase tracking-wider">Close</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-terminal-muted uppercase tracking-wider">SMA(5)</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-terminal-muted uppercase tracking-wider">Volatility</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-terminal-muted uppercase tracking-wider">Signal</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr 
                key={index} 
                className="border-t border-terminal-border hover:bg-terminal-bg/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-terminal-muted font-mono">
                  {new Date(row.timestamp).toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-terminal-text text-right font-mono">₹{row.open.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-terminal-green text-right font-mono">₹{row.high.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-terminal-red text-right font-mono">₹{row.low.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-terminal-text text-right font-mono font-semibold">₹{row.close.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-terminal-orange text-right font-mono">
                  {row.sma_5 ? `₹${row.sma_5.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-terminal-purple text-right font-mono">
                  {row.volatility ? row.volatility.toFixed(4) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={getSignalClass(row.signal)}>{row.signal}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Loading Skeleton
const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 bg-terminal-surface rounded-xl shimmer"></div>
      ))}
    </div>
    <div className="h-96 bg-terminal-surface rounded-xl shimmer"></div>
    <div className="h-64 bg-terminal-surface rounded-xl shimmer"></div>
  </div>
);

// Main App Component
function App() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('RELIANCE.NS');
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(60);

  // Fetch stock list
  const fetchStocks = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/stocks`);
      setStocks(response.data);
    } catch (err) {
      console.error('Error fetching stocks:', err);
      // Fallback stock list
      setStocks([
        { ticker: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy' },
        { ticker: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'IT' },
        { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
        { ticker: 'INFY.NS', name: 'Infosys', sector: 'IT' },
        { ticker: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
      ]);
    }
  }, []);

  // Fetch stock data
  const fetchStockData = useCallback(async (ticker) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/stocks/${ticker}`);
      setStockData(response.data);
      setLastRefresh(new Date());
      setRefreshCountdown(60);
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError('Failed to fetch stock data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  // Fetch data when selected stock changes
  useEffect(() => {
    if (selectedStock) {
      fetchStockData(selectedStock);
    }
  }, [selectedStock, fetchStockData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchStockData(selectedStock);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedStock, fetchStockData]);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchStockData(selectedStock);
  };

  return (
    <div className="flex h-screen bg-terminal-bg" data-testid="app-container">
      {/* Sidebar */}
      <StockSidebar
        stocks={stocks}
        selectedStock={selectedStock}
        onSelectStock={setSelectedStock}
        loading={loading}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-terminal-surface/95 backdrop-blur-sm border-b border-terminal-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-terminal-blue" />
                <h1 className="text-xl font-bold text-terminal-text">NiftyStream-DE</h1>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-terminal-green/20 text-terminal-green border border-terminal-green/30">
                LIVE
              </span>
              {stockData?.is_mock_data && (
                <span className="text-xs px-2 py-1 rounded bg-terminal-orange/20 text-terminal-orange border border-terminal-orange/30">
                  MOCK DATA
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Auto-refresh toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    autoRefreshEnabled
                      ? 'bg-terminal-green/20 border-terminal-green/30 text-terminal-green'
                      : 'bg-terminal-surface border-terminal-border text-terminal-muted'
                  }`}
                  data-testid="auto-refresh-toggle"
                >
                  Auto-refresh: {autoRefreshEnabled ? 'ON' : 'OFF'}
                </button>
                {autoRefreshEnabled && (
                  <span className="text-xs text-terminal-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {refreshCountdown}s
                  </span>
                )}
              </div>

              {/* Manual refresh button */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-terminal-blue/20 hover:bg-terminal-blue/30 border border-terminal-blue/30 text-terminal-blue rounded-lg transition-all disabled:opacity-50"
                data-testid="refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh Now</span>
              </button>

              {/* Last refresh time */}
              {lastRefresh && (
                <span className="text-xs text-terminal-muted">
                  Last: {lastRefresh.toLocaleTimeString('en-IN')}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-terminal-red/10 border border-terminal-red/30 rounded-xl text-terminal-red" data-testid="error-alert">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {loading && !stockData ? (
            <LoadingSkeleton />
          ) : stockData ? (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-grid">
                <MetricCard
                  title="Current Price"
                  value={`₹${stockData.metrics.current_price.toLocaleString('en-IN')}`}
                  subtitle={stockData.name}
                  icon={Activity}
                  color="blue"
                  trend={stockData.metrics.change_percent}
                />
                <MetricCard
                  title="Day High"
                  value={`₹${stockData.metrics.day_high.toLocaleString('en-IN')}`}
                  subtitle="Intraday maximum"
                  icon={TrendingUp}
                  color="green"
                />
                <MetricCard
                  title="Day Low"
                  value={`₹${stockData.metrics.day_low.toLocaleString('en-IN')}`}
                  subtitle="Intraday minimum"
                  icon={TrendingDown}
                  color="red"
                />
                <MetricCard
                  title="Volatility Score"
                  value={stockData.metrics.volatility.toFixed(4)}
                  subtitle="Std Dev (5-period)"
                  icon={BarChart3}
                  color="purple"
                />
              </div>

              {/* Signal Indicator */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${
                stockData.metrics.signal === 'BUY' 
                  ? 'bg-terminal-green/10 border-terminal-green/30' 
                  : stockData.metrics.signal === 'SELL'
                  ? 'bg-terminal-red/10 border-terminal-red/30'
                  : 'bg-terminal-orange/10 border-terminal-orange/30'
              }`} data-testid="signal-indicator">
                <div className="flex items-center gap-3">
                  {stockData.metrics.signal === 'BUY' ? (
                    <ArrowUpRight className="w-6 h-6 text-terminal-green" />
                  ) : stockData.metrics.signal === 'SELL' ? (
                    <ArrowDownRight className="w-6 h-6 text-terminal-red" />
                  ) : (
                    <Minus className="w-6 h-6 text-terminal-orange" />
                  )}
                  <div>
                    <span className="text-lg font-bold text-terminal-text">Current Signal: </span>
                    <span className={`text-lg font-bold ${
                      stockData.metrics.signal === 'BUY' 
                        ? 'text-terminal-green' 
                        : stockData.metrics.signal === 'SELL'
                        ? 'text-terminal-red'
                        : 'text-terminal-orange'
                    }`}>
                      {stockData.metrics.signal}
                    </span>
                  </div>
                </div>
                <span className="text-sm text-terminal-muted">
                  Based on Price vs 5-period SMA comparison
                </span>
              </div>

              {/* Chart */}
              <StockChart data={stockData.data} stockName={stockData.name} />

              {/* Data Table */}
              <DataTable data={stockData.data} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default App;
