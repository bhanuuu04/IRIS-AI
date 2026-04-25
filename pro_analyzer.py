"""
pro_analyzer.py — IRIS PRO TRADER MODE Deep Analysis Engine
Multi-window Z-scores + 70/30 weighted daily/intraday signal fusion.
"""
import pandas as pd
import numpy as np
import math

from analyzer import _safe, _daily_context  # reuse helpers

WINDOWS = [10, 20, 50]


def _zscores_multi_window(series: pd.Series) -> tuple[float, int]:
    """
    Run Z-scores across WINDOWS. Returns (mean_z, consensus_count).
    """
    zs = []
    for w in WINDOWS:
        if len(series) >= w:
            m = series.rolling(w).mean().iloc[-1]
            s = series.rolling(w).std().iloc[-1]
            z = _safe((series.iloc[-1] - m) / s) if _safe(s) > 0 else 0.0
            zs.append(z)
    mean_z = float(np.mean(zs)) if zs else 0.0
    return mean_z, len(zs)


def _intraday_signals(df: pd.DataFrame, thresh: float) -> dict:
    """Extract short-term signals from intraday df with indicator columns."""
    if df is None or df.empty or len(df) < 10:
        return {'price_z': 0, 'vol_z': 0, 'rsi': 50, 'patterns': [], 'score': 0}

    latest = df.iloc[-1]
    prev   = df.iloc[-2] if len(df) >= 2 else latest

    returns = df['Close'].pct_change()
    volume  = df['Volume']

    price_z, _  = _zscores_multi_window(returns)
    vol_z, _    = _zscores_multi_window(volume)
    rsi         = _safe(latest.get('RSI', 50), 50)
    prev_pz     = _safe(prev.get('Price_Z_Score', 0))

    patterns = []
    prev_atr = _safe(prev.get('ATR', 0))
    avg_atr  = _safe(df['ATR'][-14:].mean(), 1.0) if 'ATR' in df.columns else 1.0
    if avg_atr == 0: avg_atr = 1.0
    prev_vr  = (prev_atr / avg_atr) if prev_atr > 0 else 1.0

    if prev_vr < 0.8 and abs(price_z) > thresh and vol_z > 1.0:
        patterns.append('Breakout after consolidation (intraday confirmed)')
    if prev_pz > 1.5 and price_z < -1.5:
        patterns.append('Bearish reversal (intraday)')
    elif prev_pz < -1.5 and price_z > 1.5:
        patterns.append('Bullish reversal (intraday)')

    score = 0
    if abs(price_z) >= thresh:
        score += min(abs(price_z) * 10, 30)
    if vol_z >= thresh:
        score += min(vol_z * 8, 20)
    if rsi >= 70:
        score += 15
    elif rsi <= 30:
        score += 15
    else:
        score += int(abs(rsi - 50) * 0.2)
    score += len(patterns) * 10
    score = min(int(score), 100)

    return {'price_z': price_z, 'vol_z': vol_z, 'rsi': rsi, 'patterns': patterns, 'score': score}


def _daily_signals(daily_df: pd.DataFrame, thresh: float) -> dict:
    """Deep multi-window analysis on daily data."""
    if daily_df is None or daily_df.empty or len(daily_df) < 30:
        return {'price_z': 0, 'vol_z': 0, 'consensus': 0, 'patterns': [], 'score': 0, 'trend': 'neutral'}

    latest = daily_df.iloc[-1]
    prev   = daily_df.iloc[-2] if len(daily_df) >= 2 else latest

    returns = daily_df['Close'].pct_change()
    volume  = daily_df['Volume']

    price_z, n_wins = _zscores_multi_window(returns)
    vol_z, _        = _zscores_multi_window(volume)

    # Count windows that agree on anomaly direction
    price_agree = 0
    vol_agree   = 0
    for w in WINDOWS:
        if len(daily_df) >= w:
            m_r = returns.rolling(w).mean().iloc[-1]
            s_r = returns.rolling(w).std().iloc[-1]
            pz  = _safe((returns.iloc[-1] - m_r) / s_r) if _safe(s_r) > 0 else 0
            if abs(pz) >= thresh: price_agree += 1
            m_v = volume.rolling(w).mean().iloc[-1]
            s_v = volume.rolling(w).std().iloc[-1]
            vz  = _safe((volume.iloc[-1] - m_v) / s_v) if _safe(s_v) > 0 else 0
            if vz >= thresh: vol_agree += 1

    consensus = (price_agree + vol_agree) / (2 * len(WINDOWS)) if WINDOWS else 0

    # Trend
    close = daily_df['Close']
    sma20 = close.rolling(20).mean().iloc[-1]
    sma50 = close.rolling(50).mean().iloc[-1] if len(daily_df) >= 50 else sma20
    trend = 'neutral'
    if _safe(sma50) > 0:
        diff = (_safe(sma20) - _safe(sma50)) / _safe(sma50) * 100
        if diff > 1.5: trend = 'up'
        elif diff < -1.5: trend = 'down'

    # Daily patterns
    patterns = []
    avg_atr = _safe(daily_df['ATR'][-50:].mean(), 1.0) if 'ATR' in daily_df.columns else 1.0
    if avg_atr == 0: avg_atr = 1.0
    prev_atr = _safe(prev.get('ATR', 0))
    if (prev_atr / avg_atr if prev_atr > 0 else 1.0) < 0.8 and abs(price_z) > thresh:
        patterns.append('Breakout after consolidation (daily confirmed)')
    prev_pz = _safe(prev.get('Price_Z_Score', 0))
    if prev_pz > 1.5 and price_z < -1.5:
        patterns.append('Bearish reversal signal (daily)')

    rsi = _safe(latest.get('RSI', 50), 50)

    score = 0
    if abs(price_z) >= thresh:
        score += min(abs(price_z) * 12, 35)
    if vol_z >= thresh:
        score += min(vol_z * 10, 25)
    if rsi >= 70:
        score += 18
    elif rsi <= 30:
        score += 18
    else:
        score += int(abs(rsi - 50) * 0.3)
    score += len(patterns) * 12
    if consensus > 0.5:
        score += 10
    if latest.get('Bearish_Divergence') == True:
        score += 10
    score = min(int(score), 100)

    return {
        'price_z': price_z, 'vol_z': vol_z,
        'consensus': consensus, 'patterns': patterns,
        'score': score, 'trend': trend,
        'price_agree': price_agree, 'vol_agree': vol_agree,
        'n_wins': n_wins,
    }


# ── Main PRO Analyzer ──────────────────────────────────────────────────────

def deep_analyze(df: pd.DataFrame, daily_df: pd.DataFrame = None) -> dict:
    """
    PRO TRADER MODE — 70/30 weighted fusion of daily and intraday signals.
    df       — intraday or daily chart data with indicators
    daily_df — daily data with indicators for long-term context
    """
    if df is None or df.empty or len(df) < 10:
        return {
            'mode': 'PRO', 'risk_score': 0, 'risk_level': 'UNKNOWN',
            'confidence': 0, 'reasons': [], 'pattern_detected': [],
            'explanation': 'Insufficient data for PRO deep scan.',
            'depth': 'deep', 'signal_strength': 'weak',
            'multi_timeframe_note': 'N/A',
        }

    # Dynamic threshold (stricter in PRO: +0.3)
    cur_atr = _safe(df.iloc[-1].get('ATR', 0))
    avg_atr = _safe(df['ATR'][-14:].mean(), 1.0) if 'ATR' in df.columns else 1.0
    if avg_atr == 0: avg_atr = 1.0
    vol_ratio = max(0.5, min(2.0, cur_atr / avg_atr)) if cur_atr > 0 else 1.0
    thresh = (1.2 + 0.3) * math.sqrt(vol_ratio)  # stricter than normal

    # ── Run both pipelines ─────────────────────────────────────────────────
    short = _intraday_signals(df, thresh)

    # If no separate daily_df, use df itself as daily context
    effective_daily = daily_df if daily_df is not None else df
    long  = _daily_signals(effective_daily, thresh)

    # ── 70/30 Weighted Fusion ──────────────────────────────────────────────
    W_LONG, W_SHORT = 0.70, 0.30
    fused_score = (long['score'] * W_LONG) + (short['score'] * W_SHORT)

    # Combined patterns (deduplicated)
    all_patterns = list(dict.fromkeys(long['patterns'] + short['patterns']))

    # ── Confidence Calculation ─────────────────────────────────────────────
    confidence = 45

    # Multi-timeframe agreement boosts confidence
    short_bullish = short['price_z'] > thresh
    short_bearish = short['price_z'] < -thresh
    long_bullish  = long['price_z'] > thresh
    long_bearish  = long['price_z'] < -thresh

    if (short_bullish and long_bullish) or (short_bearish and long_bearish):
        confidence += 20
        tf_agree = 'Both short and long-term confirm the same direction.'
    elif (short_bullish and long_bearish) or (short_bearish and long_bullish):
        confidence -= 15
        fused_score *= 0.85  # reduce score on conflict
        tf_agree = 'Conflicting signals: short-term and long-term disagree.'
    else:
        tf_agree = 'Mixed signals across timeframes.'

    if long['consensus'] > 0.5:
        confidence += 12
    if len(all_patterns) > 1:
        confidence += 8

    confidence = min(max(int(confidence), 25), 100)
    risk_score  = min(max(int(fused_score), 0), 100)

    # ── Risk Level ─────────────────────────────────────────────────────────
    if risk_score >= 70:
        risk_level = 'HIGH'
    elif risk_score >= 35:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'

    # ── Signal Strength ────────────────────────────────────────────────────
    combined_signals = sum([
        1 if abs(short['price_z']) >= thresh else 0,
        1 if short['vol_z'] >= thresh else 0,
        1 if abs(long['price_z']) >= thresh else 0,
        1 if long['vol_z'] >= thresh else 0,
        1 if long['consensus'] > 0.5 else 0,
        1 if len(all_patterns) > 0 else 0,
    ])
    if combined_signals >= 4:
        signal_strength = 'strong'
    elif combined_signals >= 2:
        signal_strength = 'moderate'
    else:
        signal_strength = 'weak'

    # ── Explanations ───────────────────────────────────────────────────────
    expl = []
    if long['trend'] != 'neutral':
        expl.append(f"[PRO] Long-term trend: {long['trend'].upper()}.")
    if abs(long['price_z']) >= thresh:
        d = 'surge' if long['price_z'] > 0 else 'drop'
        expl.append(f"[PRO] Daily price {d} confirmed across {long['price_agree']}/{long['n_wins']} windows (Z: {long['price_z']:.2f}).")
    if abs(short['price_z']) >= thresh:
        d = 'spike' if short['price_z'] > 0 else 'dip'
        expl.append(f"[PRO] Short-term price {d} detected (Z: {short['price_z']:.2f}).")
    if short['rsi'] >= 70:
        expl.append(f"[PRO] RSI overbought at {short['rsi']:.1f} — exhaustion risk.")
    elif short['rsi'] <= 30:
        expl.append(f"[PRO] RSI oversold at {short['rsi']:.1f} — potential bounce zone.")
    expl.append(tf_agree)
    if not expl:
        expl.append('[PRO] Market behaviour within normal parameters across all windows.')

    mtf_note = (
        f"70% daily weight: {long['score']} pts | "
        f"30% intraday weight: {short['score']} pts | "
        f"Window consensus: {int(long['consensus']*100)}%"
    )

    return {
        'mode': 'PRO',
        'risk_score': risk_score,
        'risk_level': risk_level,
        'confidence': confidence,
        'reasons': expl,
        'pattern_detected': all_patterns,
        'explanation': ' '.join(expl),
        'depth': 'deep',
        'signal_strength': signal_strength,
        'multi_timeframe_note': mtf_note,
    }
