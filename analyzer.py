"""
analyzer.py — IRIS Normal Mode Risk Engine
Supports dual-context: intraday (short-term) + daily (long-term).
"""
import pandas as pd
import math

# ── Helpers ────────────────────────────────────────────────────────────────

def _safe(val, default=0):
    """Return val if valid float, else default."""
    try:
        v = float(val)
        return default if math.isnan(v) or math.isinf(v) else v
    except (TypeError, ValueError):
        return default


def _daily_context(daily_df: pd.DataFrame) -> dict:
    """
    Extract long-term signals from the daily dataframe.
    Returns a dict of context flags and values.
    """
    ctx = {
        'trend': 'neutral',      # 'up' | 'down' | 'neutral'
        'trend_strength': 0.0,   # % difference between SMA20 and SMA50
        'daily_vol_ratio': 1.0,  # current ATR / 50-day avg ATR
        'daily_price_z': 0.0,    # 20-day Z-score of latest daily return
        'daily_vol_z': 0.0,      # 20-day Z-score of volume
        'is_available': False,
    }
    if daily_df is None or daily_df.empty or len(daily_df) < 30:
        return ctx

    ctx['is_available'] = True
    close = daily_df['Close']
    volume = daily_df['Volume']

    # Trend: SMA20 vs SMA50
    sma20 = close.rolling(20).mean().iloc[-1]
    sma50 = close.rolling(50).mean().iloc[-1] if len(daily_df) >= 50 else sma20
    if _safe(sma50) > 0:
        pct_diff = (_safe(sma20) - _safe(sma50)) / _safe(sma50) * 100
        ctx['trend_strength'] = round(pct_diff, 2)
        if pct_diff > 1.5:
            ctx['trend'] = 'up'
        elif pct_diff < -1.5:
            ctx['trend'] = 'down'

    # Daily volatility ratio (ATR-based)
    if 'ATR' in daily_df.columns:
        cur_atr  = _safe(daily_df['ATR'].iloc[-1])
        avg_atr  = _safe(daily_df['ATR'][-50:].mean(), 1.0) or 1.0
        ctx['daily_vol_ratio'] = max(0.3, min(3.0, cur_atr / avg_atr))

    # Daily Z-scores (20-period)
    returns = close.pct_change()
    m_r = returns.rolling(20).mean().iloc[-1]
    s_r = returns.rolling(20).std().iloc[-1]
    if _safe(s_r) > 0:
        ctx['daily_price_z'] = _safe((returns.iloc[-1] - m_r) / s_r)

    m_v = volume.rolling(20).mean().iloc[-1]
    s_v = volume.rolling(20).std().iloc[-1]
    if _safe(s_v) > 0:
        ctx['daily_vol_z'] = _safe((volume.iloc[-1] - m_v) / s_v)

    return ctx


# ── Main Analyzer ──────────────────────────────────────────────────────────

def analyze_risk(df: pd.DataFrame, daily_df: pd.DataFrame = None) -> dict:
    """
    Normal mode risk analysis.
    df        — intraday or daily OHLCV with indicators (chart timeframe)
    daily_df  — optional daily OHLCV with indicators for long-term context
    """
    if df is None or df.empty or len(df) < 10:
        return {
            'risk_score': 0, 'risk_level': 'UNKNOWN', 'confidence': 0,
            'reasons': [], 'pattern_detected': [],
            'explanation': 'Insufficient data for analysis.'
        }

    latest = df.iloc[-1]
    prev   = df.iloc[-2] if len(df) >= 2 else latest

    # ── 1. Short-term signals (from df) ─────────────────────────────────────
    cur_atr  = _safe(latest.get('ATR', 0))
    avg_atr  = _safe(df['ATR'][-14:].mean(), 1.0) if 'ATR' in df.columns else 1.0
    if avg_atr == 0: avg_atr = 1.0

    vol_ratio      = max(0.5, min(2.0, cur_atr / avg_atr)) if cur_atr > 0 else 1.0
    dynamic_thresh = 1.2 * math.sqrt(vol_ratio)
    strong_thresh  = 1.8 * math.sqrt(vol_ratio)

    price_z = _safe(latest.get('Price_Z_Score', 0))
    vol_z   = _safe(latest.get('Volume_Z_Score', 0))
    rsi     = _safe(latest.get('RSI', 50), 50)
    macd    = _safe(latest.get('MACD', 0))
    macd_sig= _safe(latest.get('MACD_Signal', 0))
    prev_pz = _safe(prev.get('Price_Z_Score', 0))

    # ── 2. Long-term context (from daily_df) ────────────────────────────────
    ctx = _daily_context(daily_df)

    # ── 3. Pattern Detection ────────────────────────────────────────────────
    patterns = []
    prev_atr = _safe(prev.get('ATR', 0))
    prev_vr  = (prev_atr / avg_atr) if prev_atr > 0 else 1.0

    if prev_vr < 0.8 and abs(price_z) > dynamic_thresh and vol_z > 1.0:
        patterns.append('Breakout after consolidation detected')

    price_pct = _safe(df['Close'].pct_change().iloc[-1])
    if price_pct > 0.005 and price_z > 0.8 and vol_z < 0:
        patterns.append('Weak breakout with low volume support')

    if prev_pz > 1.5 and price_z < -1.5:
        patterns.append('Potential bearish reversal after abnormal move')
    elif prev_pz < -1.5 and price_z > 1.5:
        patterns.append('Potential bullish reversal after abnormal move')

    # ── 4. Score Calculation ────────────────────────────────────────────────
    risk_score = 0
    explanations = []

    # A. Short-term price Z-score
    if abs(price_z) >= strong_thresh:
        risk_score += min(abs(price_z) * 12, 35)
        d = 'surged' if price_z > 0 else 'plummeted'
        explanations.append(f'Price {d} strongly (Z: {price_z:.2f}) on {df.index[-1].strftime("%b %d") if hasattr(df.index[-1], "strftime") else ""}.')
    elif abs(price_z) >= dynamic_thresh:
        risk_score += min(abs(price_z) * 7, 18)
        d = 'rose' if price_z > 0 else 'fell'
        explanations.append(f'Price {d} moderately outside normal range (Z: {price_z:.2f}).')

    # B. Short-term volume Z-score
    if vol_z >= strong_thresh:
        risk_score += min(vol_z * 10, 25)
        explanations.append(f'Volume surged strongly ({vol_z:.2f} SDs above average).')
    elif vol_z >= dynamic_thresh:
        risk_score += min(vol_z * 6, 12)
        explanations.append(f'Volume elevated ({vol_z:.2f} SDs above average).')

    # C. Long-term context bonus/modifier
    if ctx['is_available']:
        if ctx['trend'] == 'down' and price_z > 0:
            # Counter-trend bounce in downtrend = higher risk
            risk_score += 8
            explanations.append(f'Counter-trend bounce in long-term downtrend (SMA spread: {ctx["trend_strength"]:.1f}%).')
        elif ctx['trend'] == 'down':
            risk_score += 5
            explanations.append(f'Long-term downtrend confirmed (SMA20 < SMA50 by {abs(ctx["trend_strength"]):.1f}%).')
        elif ctx['trend'] == 'up':
            explanations.append(f'Long-term uptrend active (SMA20 > SMA50 by {ctx["trend_strength"]:.1f}%).')

        if abs(ctx['daily_price_z']) >= 1.5:
            risk_score += 8
            d = 'positive' if ctx['daily_price_z'] > 0 else 'negative'
            explanations.append(f'Daily timeframe also shows {d} anomaly (Z: {ctx["daily_price_z"]:.2f}) — multi-timeframe confirmation.')
        
        if ctx['daily_vol_ratio'] > 1.5:
            risk_score += 5
            explanations.append(f'Daily volatility elevated ({ctx["daily_vol_ratio"]:.2f}x above 50-day average).')

    # D. RSI component
    if rsi >= 75:
        risk_score += 20
        explanations.append(f'RSI extremely overbought at {rsi:.1f}.')
    elif rsi >= 65:
        risk_score += 12
        explanations.append(f'RSI overbought at {rsi:.1f}.')
    elif rsi <= 25:
        risk_score += 20
        explanations.append(f'RSI extremely oversold at {rsi:.1f}.')
    elif rsi <= 35:
        risk_score += 12
        explanations.append(f'RSI oversold at {rsi:.1f}.')
    else:
        risk_score += int(abs(rsi - 50) * 0.3)
        explanations.append(f'RSI at {rsi:.1f} — within normal range.')

    # E. MACD component
    if macd < macd_sig:
        risk_score += 8
        explanations.append('MACD bearish crossover — downward momentum active.')
    elif macd > macd_sig:
        risk_score += 4
        explanations.append('MACD bullish crossover — upward momentum active.')

    # F. Patterns
    risk_score += len(patterns) * 10

    # G. Divergence
    if latest.get('Bearish_Divergence') == True:
        risk_score += 12
        explanations.append('Bearish price-volume divergence: price rising on falling participation.')

    risk_score = min(max(int(risk_score), 0), 100)

    # ── 5. Risk Level ────────────────────────────────────────────────────────
    if risk_score >= 70:
        risk_level = 'HIGH'
    elif risk_score >= 35:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'

    # ── 6. Confidence — boosted if short + long agree ────────────────────────
    signal_str = (abs(vol_z) + abs(price_z)) * 7
    confidence = 40 + int(signal_str) + len(patterns) * 8

    if ctx['is_available']:
        # Both timeframes agree → boost confidence
        short_bullish  = price_z > dynamic_thresh
        short_bearish  = price_z < -dynamic_thresh
        long_bullish   = ctx['daily_price_z'] > 1.0
        long_bearish   = ctx['daily_price_z'] < -1.0
        if (short_bullish and long_bullish) or (short_bearish and long_bearish):
            confidence += 15
            explanations.append('Multi-timeframe alignment: short and long-term signals agree.')
        elif (short_bullish and long_bearish) or (short_bearish and long_bullish):
            confidence -= 12
            explanations.append('Caution: short-term and long-term signals conflict.')

    confidence = min(max(confidence, 25), 100)

    return {
        'risk_score': risk_score,
        'risk_level': risk_level,
        'confidence': confidence,
        'reasons': explanations,
        'pattern_detected': patterns,
        'explanation': ' '.join(explanations),
    }
