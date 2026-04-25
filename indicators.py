import pandas as pd
import numpy as np

def calculate_rsi(data: pd.DataFrame, window: int = 14) -> pd.DataFrame:
    df = data.copy()
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    return df

def calculate_macd(data: pd.DataFrame, short_window: int = 12, long_window: int = 26, signal_window: int = 9) -> pd.DataFrame:
    df = data.copy()
    short_ema = df['Close'].ewm(span=short_window, adjust=False).mean()
    long_ema = df['Close'].ewm(span=long_window, adjust=False).mean()
    df['MACD'] = short_ema - long_ema
    df['MACD_Signal'] = df['MACD'].ewm(span=signal_window, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
    return df

def calculate_support_resistance(data: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    df = data.copy()
    df['Support'] = df['Low'].rolling(window=window).min()
    df['Resistance'] = df['High'].rolling(window=window).max()
    return df

def calculate_atr(data: pd.DataFrame, window: int = 14) -> pd.DataFrame:
    df = data.copy()
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['ATR'] = true_range.rolling(window=window).mean()
    return df

def calculate_zscores(data: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    df = data.copy()
    # Price Return Z-Score
    returns = df['Close'].pct_change()
    mean_return = returns.rolling(window=window).mean()
    std_return = returns.rolling(window=window).std()
    df['Price_Z_Score'] = (returns - mean_return) / std_return

    # Volume Z-Score
    mean_volume = df['Volume'].rolling(window=window).mean()
    std_volume = df['Volume'].rolling(window=window).std()
    df['Volume_Z_Score'] = (df['Volume'] - mean_volume) / std_volume
    return df

def detect_divergence(data: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Detects price-volume divergence over a short window."""
    df = data.copy()
    df['Price_Trend'] = df['Close'].diff(window)
    df['Volume_Trend'] = df['Volume'].diff(window)
    
    # Bearish divergence: Price up, volume down
    df['Bearish_Divergence'] = (df['Price_Trend'] > 0) & (df['Volume_Trend'] < 0)
    # Bullish divergence: Price down, volume up (often a capitulation signal)
    df['Bullish_Divergence'] = (df['Price_Trend'] < 0) & (df['Volume_Trend'] > 0)
    
    return df

def calculate_bollinger_bands(data: pd.DataFrame, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    """Adds BB_Upper, BB_Lower, BB_Mid, BB_Width (as % of mid) columns."""
    df = data.copy()
    mid   = df['Close'].rolling(window).mean()
    std   = df['Close'].rolling(window).std()
    df['BB_Upper'] = mid + num_std * std
    df['BB_Lower'] = mid - num_std * std
    df['BB_Mid']   = mid
    df['BB_Width']  = ((df['BB_Upper'] - df['BB_Lower']) / mid.replace(0, np.nan)).fillna(0)
    return df


def calculate_adx(data: pd.DataFrame, window: int = 14) -> pd.DataFrame:
    """Adds ADX, Plus_DI, Minus_DI columns."""
    df   = data.copy()
    high = df['High']
    low  = df['Low']
    close = df['Close']

    hl  = high - low
    hpc = (high - close.shift()).abs()
    lpc = (low  - close.shift()).abs()
    tr  = pd.concat([hl, hpc, lpc], axis=1).max(axis=1)

    up_move  = high.diff()
    dn_move  = (-low.diff())
    plus_dm  = np.where((up_move > dn_move) & (up_move > 0),  up_move, 0.0)
    minus_dm = np.where((dn_move > up_move) & (dn_move > 0), dn_move, 0.0)

    plus_dm_s  = pd.Series(plus_dm,  index=df.index).rolling(window).sum()
    minus_dm_s = pd.Series(minus_dm, index=df.index).rolling(window).sum()
    tr_s       = tr.rolling(window).sum().replace(0, np.nan)

    plus_di  = (100 * plus_dm_s  / tr_s).fillna(0)
    minus_di = (100 * minus_dm_s / tr_s).fillna(0)
    dx_denom = (plus_di + minus_di).replace(0, np.nan)
    dx       = (100 * (plus_di - minus_di).abs() / dx_denom).fillna(0)
    adx      = dx.rolling(window).mean()

    df['ADX']      = adx
    df['Plus_DI']  = plus_di
    df['Minus_DI'] = minus_di
    return df


def add_all_indicators(data: pd.DataFrame) -> pd.DataFrame:
    if data is None or data.empty:
        return data
        
    df = calculate_rsi(data)
    df = calculate_macd(df)
    df = calculate_support_resistance(df)
    df = calculate_atr(df)
    df = calculate_zscores(df)
    df = detect_divergence(df)
    df = calculate_bollinger_bands(df)
    df = calculate_adx(df)
    return df
