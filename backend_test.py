import requests
import sys
import json
from datetime import datetime

class NiftyStreamAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.expected_stocks = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"]
        self.expected_sectors = ["Energy", "IT", "Banking"]

    def run_test(self, name, method, endpoint, expected_status, expected_data_checks=None):
        """Run a single API test with data validation"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            
            print(f"   Status Code: {response.status_code}")
            
            # Check status code
            status_success = response.status_code == expected_status
            if not status_success:
                print(f"❌ Failed - Expected status {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}...")
                return False, {}

            # Parse JSON response
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                print(f"❌ Failed - Invalid JSON response")
                return False, {}

            # Run data validation checks
            if expected_data_checks:
                for check_name, check_func in expected_data_checks.items():
                    try:
                        check_result = check_func(response_data)
                        if not check_result:
                            print(f"❌ Failed - Data validation '{check_name}' failed")
                            return False, response_data
                        else:
                            print(f"   ✓ {check_name}")
                    except Exception as e:
                        print(f"❌ Failed - Data validation '{check_name}' error: {str(e)}")
                        return False, response_data

            self.tests_passed += 1
            print(f"✅ Passed")
            return True, response_data

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Request error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Unexpected error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        def validate_health(data):
            return (
                'status' in data and data['status'] == 'healthy' and
                'service' in data and data['service'] == 'NiftyStream-DE' and
                'timestamp' in data
            )
        
        return self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200,
            {"Health response structure": validate_health}
        )

    def test_get_stocks(self):
        """Test get stocks list endpoint"""
        def validate_stocks_list(data):
            if not isinstance(data, list) or len(data) != 5:
                return False
            
            tickers = [stock.get('ticker') for stock in data]
            sectors = [stock.get('sector') for stock in data]
            
            # Check all expected stocks are present
            for expected_ticker in self.expected_stocks:
                if expected_ticker not in tickers:
                    return False
            
            # Check sectors are valid
            for sector in sectors:
                if sector not in self.expected_sectors:
                    return False
            
            # Check each stock has required fields
            for stock in data:
                if not all(key in stock for key in ['ticker', 'name', 'sector']):
                    return False
            
            return True
        
        return self.run_test(
            "Get Stocks List",
            "GET",
            "api/stocks",
            200,
            {"Stocks list validation": validate_stocks_list}
        )

    def test_get_stock_data(self, ticker):
        """Test get detailed stock data endpoint"""
        def validate_stock_data(data):
            # Check main structure
            required_fields = ['ticker', 'name', 'sector', 'metrics', 'data', 'is_mock_data']
            if not all(field in data for field in required_fields):
                return False
            
            # Check metrics structure
            metrics = data['metrics']
            metrics_fields = ['ticker', 'name', 'current_price', 'day_high', 'day_low', 'volatility', 'change_percent', 'signal']
            if not all(field in metrics for field in metrics_fields):
                return False
            
            # Check signal is valid
            if metrics['signal'] not in ['BUY', 'SELL', 'HOLD', 'WAIT']:
                return False
            
            # Check data points
            data_points = data['data']
            if not isinstance(data_points, list) or len(data_points) == 0:
                return False
            
            # Check first few data points structure
            for i, point in enumerate(data_points[:5]):
                point_fields = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
                if not all(field in point for field in point_fields):
                    return False
                
                # Check SMA and volatility are present for later points
                if i >= 4:  # SMA needs 5 points
                    if point.get('sma_5') is None or point.get('volatility') is None:
                        return False
            
            return True
        
        return self.run_test(
            f"Get Stock Data - {ticker}",
            "GET",
            f"api/stocks/{ticker}",
            200,
            {"Stock data validation": validate_stock_data}
        )

    def test_get_stock_metrics(self, ticker):
        """Test get stock metrics endpoint"""
        def validate_metrics(data):
            required_fields = ['ticker', 'name', 'current_price', 'day_high', 'day_low', 'volatility', 'change_percent', 'signal', 'is_mock_data']
            return all(field in data for field in required_fields)
        
        return self.run_test(
            f"Get Stock Metrics - {ticker}",
            "GET",
            f"api/stocks/{ticker}/metrics",
            200,
            {"Metrics validation": validate_metrics}
        )

    def test_dashboard_data(self):
        """Test dashboard overview endpoint"""
        def validate_dashboard(data):
            if 'stocks' not in data or 'timestamp' not in data:
                return False
            
            stocks = data['stocks']
            if not isinstance(stocks, list) or len(stocks) == 0:
                return False
            
            # Check each stock has metrics
            for stock in stocks:
                required_fields = ['ticker', 'name', 'current_price', 'day_high', 'day_low', 'volatility', 'change_percent', 'signal', 'sector', 'is_mock_data']
                if not all(field in stock for field in required_fields):
                    return False
            
            return True
        
        return self.run_test(
            "Dashboard Overview",
            "GET",
            "api/dashboard",
            200,
            {"Dashboard validation": validate_dashboard}
        )

    def test_data_engineering_calculations(self, ticker):
        """Test data engineering transformations (SMA, volatility, signals)"""
        success, data = self.test_get_stock_data(ticker)
        if not success:
            return False
        
        print(f"\n🔍 Testing Data Engineering Calculations for {ticker}...")
        
        data_points = data['data']
        if len(data_points) < 10:
            print("❌ Not enough data points for calculation verification")
            return False
        
        # Test SMA calculation for a few points
        for i in range(5, min(10, len(data_points))):
            point = data_points[i]
            if point['sma_5'] is None:
                continue
                
            # Calculate expected SMA
            close_prices = [data_points[j]['close'] for j in range(i-4, i+1)]
            expected_sma = sum(close_prices) / 5
            actual_sma = point['sma_5']
            
            # Allow small floating point differences
            if abs(expected_sma - actual_sma) > 0.01:
                print(f"❌ SMA calculation error at point {i}: expected {expected_sma:.2f}, got {actual_sma:.2f}")
                return False
        
        # Test signal logic
        signals_tested = 0
        for point in data_points[-10:]:
            if point['sma_5'] is not None and point['signal'] in ['BUY', 'SELL', 'HOLD']:
                expected_signal = 'BUY' if point['close'] > point['sma_5'] else 'SELL'
                if point['signal'] != expected_signal and point['signal'] != 'HOLD':
                    print(f"❌ Signal logic error: price {point['close']}, SMA {point['sma_5']}, signal {point['signal']}")
                    return False
                signals_tested += 1
        
        print(f"✅ Data Engineering calculations verified ({signals_tested} signals tested)")
        return True

def main():
    print("🚀 Starting NiftyStream-DE API Tests")
    print("=" * 50)
    
    tester = NiftyStreamAPITester()
    
    # Test basic endpoints
    tester.test_health_check()
    tester.test_get_stocks()
    
    # Test each stock's detailed data
    for ticker in tester.expected_stocks:
        tester.test_get_stock_data(ticker)
        tester.test_get_stock_metrics(ticker)
    
    # Test dashboard
    tester.test_dashboard_data()
    
    # Test data engineering calculations for first stock
    tester.test_data_engineering_calculations("RELIANCE.NS")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())