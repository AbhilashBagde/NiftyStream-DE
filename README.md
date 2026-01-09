# 📈 NiftyStream-DE: Real-Time Market Data Pipeline

<img width="1509" height="817" alt="dashboard-preview copy" src="https://github.com/user-attachments/assets/bf965b13-c972-48e7-8ec1-7286517c4633" />


![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-React%20|%20FastAPI%20|%20Pandas-blue)
![Data Source](https://img.shields.io/badge/Data-Yahoo%20Finance-purple)


## 🚀 Overview
**NiftyStream-DE** is a full-stack Data Engineering project designed to track, process, and visualize real-time stock market data for the Indian NIFTY50 index.

Unlike a standard stock app, this project focuses on the **ETL (Extract, Transform, Load) pipeline**:
1.  **Extracts** live market data using the `yfinance` API.
2.  **Transforms** raw price data using `Pandas` to generate technical indicators (SMA, Volatility).
3.  **Loads** processed insights via a high-performance **FastAPI** backend to a React UI.

## 🛠️ Tech Stack & Architecture

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React.js, Tailwind CSS | High-performance dashboard with auto-refresh logic. |
| **Backend API** | FastAPI (Python) | High-speed API for serving processed data. |
| **Ingestion** | `yfinance` | Fetches 1-minute interval data for NIFTY50 tickers. |
| **Transformation** | Pandas | Calculates Moving Averages and Algorithmic Signals on the fly. |
| **Resilience** | Fallback Logic | Includes synthetic data generation if APIs are rate-limited. |

## ✨ Key Features

* **Real-Time Ingestion:** Fetches live data for top Indian stocks (`RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`, etc.) every 60 seconds.
* **Server-Side Transformations:**
    * *Simple Moving Average (SMA):* Calculates a 5-period trend line to identify momentum.
    * *Volatility Scoring:* Computes standard deviation to gauge market risk.
    * *Algorithmic Signals:* Automatically tags stocks as **BUY** or **SELL** based on crossover logic.
* **Resilient Data Layer:** Implements a "Fallback Mode" that switches to mock data generation if the external financial API fails, ensuring zero downtime.

## ⚙️ How It Works (The Pipeline)

1.  **Trigger:** The React frontend polls the backend every 60 seconds.
2.  **Extraction:** The FastAPI backend calls Yahoo Finance to get the latest `Open`, `High`, `Low`, `Close` data.
3.  **Processing (Pandas):**
    ```python
    # Logic inside server.py
    df['SMA_5'] = df['Close'].rolling(window=5).mean()
    df['Signal'] = np.where(df['Close'] > df['SMA_5'], 'BUY', 'SELL')
    ```
4.  **Serving:** The JSON response is sent to the client, updating the DOM instantly.

## 💻 Local Installation

To run this project, you need two terminal windows (one for the backend, one for the frontend).

### 1. Clone the Repository
```bash
git clone [https://github.com/AbhilashBagde/NiftyStream-DE.git](https://github.com/AbhilashBagde/NiftyStream-DE.git)
cd NiftyStream-DE
