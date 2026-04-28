import yfinance as yf
import pandas as pd
import requests

# ── Interval classification ────────────────────────────────────────────────
INTRADAY_INTERVALS = {'5m', '15m', '1h'}

# Normal chart data periods (strictly user-facing)
CHART_PERIOD_MAP = {
    '5m':  '60d',   # max yfinance allows for 5m
    '15m': '60d',   # max yfinance allows for 15m
    '1h':  '730d',  # max yfinance allows for 1h
    '1d':  '1y',
    '1wk': '5y',
}

# Daily analysis periods (long-term context)
DAILY_PERIOD_NORMAL = '1y'
DAILY_PERIOD_PRO    = '2y'


def _safe_fetch(symbol: str, interval: str, period: str) -> pd.DataFrame | None:
    """Internal: fetch OHLCV and validate columns."""
    try:
        ticker = yf.Ticker(symbol.upper())
        df = ticker.history(period=period, interval=interval)
        if df is None or df.empty:
            return None
        required = ['Open', 'High', 'Low', 'Close', 'Volume']
        if not all(c in df.columns for c in required):
            return None
        df = df.sort_index(ascending=True)
        return df[required]
    except Exception as e:
        print(f"[DataFetcher] Error {symbol} {interval}/{period}: {e}")
        return None


from concurrent.futures import ThreadPoolExecutor

def fetch_dual_data(symbol: str, interval: str = '1d', pro_mode: bool = False) -> dict:
    """
    Returns a dict with:
      chart_df    – OHLCV for TradingView (matches user-selected interval)
      intraday_df – OHLCV intraday (None if daily/weekly selected)
      daily_df    – OHLCV daily for long-term context (always present)
      is_intraday – bool
    Parallelized using ThreadPoolExecutor for speed.
    """
    is_intraday = interval in INTRADAY_INTERVALS
    daily_period = DAILY_PERIOD_PRO if pro_mode else DAILY_PERIOD_NORMAL
    chart_period = CHART_PERIOD_MAP.get(interval, '1y')

    with ThreadPoolExecutor(max_workers=2) as pool:
        # 1. Chart data — strictly follows user interval
        chart_future = pool.submit(_safe_fetch, symbol, interval, chart_period)
        # 2. Daily context — always fetched
        daily_future = pool.submit(_safe_fetch, symbol, '1d', daily_period)
        
        chart_df = chart_future.result()
        daily_df = daily_future.result()

    # 3. Intraday analysis df — same as chart for intraday, None otherwise
    intraday_df = chart_df if is_intraday else None

    return {
        'chart_df':    chart_df,
        'intraday_df': intraday_df,
        'daily_df':    daily_df,
        'is_intraday': is_intraday,
    }


# ── Legacy helper (kept for backward compat) ──────────────────────────────
def fetch_stock_data(symbol: str, interval: str = '1d', pro_mode: bool = False) -> pd.DataFrame:
    """Backward-compat wrapper — returns chart_df only."""
    dual = fetch_dual_data(symbol, interval, pro_mode)
    return dual['chart_df']


def fetch_baseline_data() -> pd.DataFrame:
    return fetch_stock_data('SPY', '1d')


def fetch_news(symbol: str, count: int = 10) -> list:
    api_key = '6c004b2468b64ab483f95e1c2e889825'
    try:
        url = (f'https://newsapi.org/v2/everything?q={symbol}'
               f'&apiKey={api_key}&language=en&sortBy=publishedAt&pageSize={count}')
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return [
                {
                    'title':               a.get('title', ''),
                    'publisher':           a.get('source', {}).get('name', ''),
                    'link':                a.get('url', ''),
                    'providerPublishTime': a.get('publishedAt', ''),
                }
                for a in data.get('articles', [])
            ]
        print(f'[NewsAPI] HTTP {response.status_code}')
        return []
    except Exception as e:
        print(f'[NewsAPI] Error for {symbol}: {e}')
        return []
