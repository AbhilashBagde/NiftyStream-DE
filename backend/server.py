from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
from datetime import datetime, timedelta
import random
import numpy as np
import pandas as pd

# Try to import yfinance
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    print("Warning: yfinance not available, using mock data")

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NiftyStream-DE API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stock tickers to track
TRACKED_STOCKS = [
    {"ticker": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy"},
    {"ticker": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
    {"ticker": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Banking"},
    {"ticker": "INFY.NS", "name": "Infosys", "sector": "IT"},
    {"ticker": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Banking"},
]

# Models
class StockInfo(BaseModel):
    ticker: str
    name: str
    sector: str

class StockDataPoint(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    sma_5: Optional[float] = None
    volatility: Optional[float] = None
    signal: Optional[str] = None

class StockMetrics(BaseModel):
    ticker: str
    name: str
    current_price: float
    day_high: float
    day_low: float
    volatility: float
    change_percent: float
    signal: str

class StockResponse(BaseModel):
    ticker: str
    name: str
    sector: str
    metrics: StockMetrics
    data: List[StockDataPoint]
    is_mock_data: bool = False


def generate_mock_data(ticker: str, periods: int = 390) -> pd.DataFrame:
    """Generate realistic mock market data when yfinance fails"""
    # Base prices for each stock
    base_prices = {
        "RELIANCE.NS": 2450.0,
        "TCS.NS": 3850.0,
        "HDFCBANK.NS": 1650.0,
        "INFY.NS": 1480.0,
        "ICICIBANK.NS": 1020.0,
    }
    
    base_price = base_prices.get(ticker, 1000.0)
    
    # Generate timestamps for last trading day (9:15 AM to 3:30 PM IST)
    now = datetime.now()
    # Go back to last trading day
    if now.weekday() >= 5:  # Weekend
        days_back = now.weekday() - 4
        now = now - timedelta(days=days_back)
    
    start_time = now.replace(hour=9, minute=15, second=0, microsecond=0)
    
    timestamps = []
    for i in range(periods):
        timestamps.append(start_time + timedelta(minutes=i))
    
    # Generate realistic price movement
    np.random.seed(int(datetime.now().timestamp()) % 1000 + hash(ticker) % 100)
    
    returns = np.random.normal(0, 0.001, periods)  # Small random returns
    trend = np.linspace(0, np.random.uniform(-0.02, 0.02), periods)  # Slight trend
    
    prices = [base_price]
    for i in range(1, periods):
        new_price = prices[-1] * (1 + returns[i] + trend[i]/periods)
        prices.append(new_price)
    
    prices = np.array(prices)
    
    # Generate OHLCV data
    data = []
    for i, ts in enumerate(timestamps):
        close = prices[i]
        volatility = close * 0.002  # 0.2% volatility for OHLC spread
        high = close + np.random.uniform(0, volatility)
        low = close - np.random.uniform(0, volatility)
        open_price = close + np.random.uniform(-volatility/2, volatility/2)
        volume = int(np.random.uniform(50000, 500000))
        
        data.append({
            'Datetime': ts,
            'Open': round(open_price, 2),
            'High': round(high, 2),
            'Low': round(low, 2),
            'Close': round(close, 2),
            'Volume': volume
        })
    
    df = pd.DataFrame(data)
    df.set_index('Datetime', inplace=True)
    return df


def fetch_stock_data(ticker: str) -> tuple[pd.DataFrame, bool]:
    """Fetch stock data from yfinance with fallback to mock data"""
    is_mock = False
    
    if YFINANCE_AVAILABLE:
        try:
            stock = yf.Ticker(ticker)
            # Fetch 1 day of 1-minute interval data
            df = stock.history(period="1d", interval="1m")
            
            if df.empty:
                print(f"No data returned for {ticker}, using mock data")
                df = generate_mock_data(ticker)
                is_mock = True
            else:
                # Reset index to get Datetime as column
                df = df.reset_index()
                df = df.rename(columns={'index': 'Datetime'})
                if 'Datetime' not in df.columns and df.index.name:
                    df = df.reset_index()
                df.set_index('Datetime', inplace=True)
                
        except Exception as e:
            print(f"Error fetching {ticker}: {e}, using mock data")
            df = generate_mock_data(ticker)
            is_mock = True
    else:
        df = generate_mock_data(ticker)
        is_mock = True
    
    return df, is_mock


def transform_data(df: pd.DataFrame) -> pd.DataFrame:
    """Apply data engineering transformations"""
    # Ensure we have the required columns
    df = df.copy()
    
    # Calculate 5-period Simple Moving Average (SMA)
    df['SMA_5'] = df['Close'].rolling(window=5).mean()
    
    # Calculate Volatility (Standard Deviation of last 5 prices)
    df['Volatility'] = df['Close'].rolling(window=5).std()
    
    # Generate Buy/Sell Signal
    df['Signal'] = df.apply(
        lambda row: 'BUY' if row['Close'] > row['SMA_5'] else ('SELL' if row['Close'] < row['SMA_5'] else 'HOLD')
        if pd.notna(row['SMA_5']) else 'WAIT',
        axis=1
    )
    
    return df


def calculate_metrics(df: pd.DataFrame, ticker: str) -> dict:
    """Calculate stock metrics"""
    stock_info = next((s for s in TRACKED_STOCKS if s['ticker'] == ticker), None)
    name = stock_info['name'] if stock_info else ticker
    
    current_price = float(df['Close'].iloc[-1])
    day_high = float(df['High'].max())
    day_low = float(df['Low'].min())
    volatility = float(df['Volatility'].iloc[-1]) if pd.notna(df['Volatility'].iloc[-1]) else 0.0
    
    # Calculate change percentage
    open_price = float(df['Open'].iloc[0])
    change_percent = ((current_price - open_price) / open_price) * 100
    
    # Get latest signal
    signal = df['Signal'].iloc[-1]
    
    return {
        'ticker': ticker,
        'name': name,
        'current_price': round(current_price, 2),
        'day_high': round(day_high, 2),
        'day_low': round(day_low, 2),
        'volatility': round(volatility, 4),
        'change_percent': round(change_percent, 2),
        'signal': signal
    }


# API Endpoints
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "NiftyStream-DE", "timestamp": datetime.now().isoformat()}


@app.get("/api/stocks", response_model=List[StockInfo])
async def get_stocks():
    """Get list of all tracked stocks"""
    return TRACKED_STOCKS


@app.get("/api/stocks/{ticker}")
async def get_stock_data(ticker: str):
    """Get detailed stock data with transformations"""
    # Validate ticker
    stock_info = next((s for s in TRACKED_STOCKS if s['ticker'] == ticker), None)
    if not stock_info:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")
    
    # Fetch data
    df, is_mock = fetch_stock_data(ticker)
    
    # Apply transformations
    df = transform_data(df)
    
    # Calculate metrics
    metrics = calculate_metrics(df, ticker)
    
    # Prepare data points
    data_points = []
    for idx, row in df.iterrows():
        timestamp = idx.isoformat() if hasattr(idx, 'isoformat') else str(idx)
        data_points.append({
            'timestamp': timestamp,
            'open': round(float(row['Open']), 2),
            'high': round(float(row['High']), 2),
            'low': round(float(row['Low']), 2),
            'close': round(float(row['Close']), 2),
            'volume': int(row['Volume']),
            'sma_5': round(float(row['SMA_5']), 2) if pd.notna(row['SMA_5']) else None,
            'volatility': round(float(row['Volatility']), 4) if pd.notna(row['Volatility']) else None,
            'signal': row['Signal']
        })
    
    return {
        'ticker': ticker,
        'name': stock_info['name'],
        'sector': stock_info['sector'],
        'metrics': metrics,
        'data': data_points,
        'is_mock_data': is_mock
    }


@app.get("/api/stocks/{ticker}/metrics")
async def get_stock_metrics(ticker: str):
    """Get only stock metrics (lighter endpoint)"""
    stock_info = next((s for s in TRACKED_STOCKS if s['ticker'] == ticker), None)
    if not stock_info:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")
    
    df, is_mock = fetch_stock_data(ticker)
    df = transform_data(df)
    metrics = calculate_metrics(df, ticker)
    
    return {**metrics, 'is_mock_data': is_mock}


@app.get("/api/dashboard")
async def get_dashboard_data():
    """Get overview data for all stocks"""
    results = []
    for stock in TRACKED_STOCKS:
        try:
            df, is_mock = fetch_stock_data(stock['ticker'])
            df = transform_data(df)
            metrics = calculate_metrics(df, stock['ticker'])
            results.append({**metrics, 'sector': stock['sector'], 'is_mock_data': is_mock})
        except Exception as e:
            print(f"Error processing {stock['ticker']}: {e}")
            continue
    
    return {'stocks': results, 'timestamp': datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
