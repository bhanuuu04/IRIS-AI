import pandas as pd
import math

def get_anomaly_markers(df: pd.DataFrame) -> list:
    """
    Scan the dataframe for historical anomalies and return markers for TradingView charts.
    """
    if df is None or df.empty or len(df) < 20:
        return []

    markers = []
    
    # Calculate rolling stats for anomaly detection
    # We use a 20-period window for Z-scores
    returns = df['Close'].pct_change()
    price_mean = returns.rolling(20).mean()
    price_std = returns.rolling(20).std()
    
    vol_mean = df['Volume'].rolling(20).mean()
    vol_std = df['Volume'].rolling(20).std()
    
    # ATR for positioning markers
    atr = df['High'] - df['Low'] # Simple range as ATR proxy
    if 'ATR' in df.columns:
        atr = df['ATR']

    # We only scan the last 150 candles to keep chart clean
    scan_df = df.tail(150)
    
    for i in range(len(scan_df)):
        idx = scan_df.index[i]
        row = scan_df.iloc[i]
        
        timestamp = int(idx.timestamp())
        
        # 1. Volume Anomaly
        v_z = 0
        if vol_std[idx] > 0:
            v_z = (row['Volume'] - vol_mean[idx]) / vol_std[idx]
        
        if v_z > 2.5:
            markers.append({
                'time': timestamp,
                'position': 'belowBar',
                'color': '#ef5350', # Red
                'shape': 'circle',
                'text': 'V',
                'type': 'volume',
                'description': f'Volume Spike: {v_z:.1f}σ above average'
            })
            
        # 2. Price Anomaly
        p_z = 0
        if price_std[idx] > 0:
            p_z = (returns[idx] - price_mean[idx]) / price_std[idx]
            
        if abs(p_z) > 2.5:
            d = 'Surge' if p_z > 0 else 'Drop'
            markers.append({
                'time': timestamp,
                'position': 'aboveBar',
                'color': '#fb8c00', # Orange
                'shape': 'circle',
                'text': 'P',
                'type': 'price',
                'description': f'Price {d}: {abs(p_z):.1f}σ deviation'
            })

        # 3. Basic Pattern: Reversal
        # Check if current Z is extreme and previous was opposite extreme
        if i > 0:
            prev_idx = scan_df.index[i-1]
            prev_pz = (returns[prev_idx] - price_mean[prev_idx]) / price_std[prev_idx] if price_std[prev_idx] > 0 else 0
            
            if prev_pz > 1.5 and p_z < -1.5:
                markers.append({
                    'time': timestamp,
                    'position': 'aboveBar',
                    'color': '#aa00ff', # Purple
                    'shape': 'pin',
                    'text': 'R',
                    'type': 'pattern',
                    'description': 'Bearish Reversal Pattern'
                })
            elif prev_pz < -1.5 and p_z > 1.5:
                markers.append({
                    'time': timestamp,
                    'position': 'belowBar',
                    'color': '#00e676', # Green
                    'shape': 'pin',
                    'text': 'R',
                    'type': 'pattern',
                    'description': 'Bullish Reversal Pattern'
                })

    # Sort by time
    markers.sort(key=lambda x: x['time'])
    return markers

def get_breakout_zones(df: pd.DataFrame) -> list:
    """
    Detect recent consolidation zones that led to breakouts.
    Returns list of zones: {'start_time', 'end_time', 'high', 'low', 'type'}
    """
    if df is None or len(df) < 30:
        return []
        
    zones = []
    # Simple logic: look for low volatility periods followed by high volatility
    # We use a 10-candle window for consolidation
    window = 10
    for i in range(window, len(df) - 5):
        chunk = df.iloc[i-window:i]
        high = chunk['High'].max()
        low = chunk['Low'].min()
        range_pct = (high - low) / low * 100
        
        # Consolidation if range < 0.5% (very tight)
        if range_pct < 0.6:
            # Check for breakout in next 3 candles
            next_candles = df.iloc[i:i+3]
            breakout_up = next_candles['High'].max() > high * 1.003
            breakout_down = next_candles['Low'].min() < low * 0.997
            
            if breakout_up or breakout_down:
                zones.append({
                    'start': int(chunk.index[0].timestamp()),
                    'end': int(chunk.index[-1].timestamp()),
                    'high': float(high),
                    'low': float(low),
                    'type': 'bullish' if breakout_up else 'bearish'
                })
                # Skip forward to avoid overlapping zones
                i += 10 
                
    return zones[-2:] # Only return the 2 most recent zones
