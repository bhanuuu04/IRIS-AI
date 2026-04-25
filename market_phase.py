"""
market_phase.py — IRIS Market Phase Detection Engine
Automatically classifies the current market phase using pure quantitative logic.

Phases:
  TRENDING     🔥 — Strong directional move (high ADX + SMA alignment)
  RANGING      🟡 — Sideways/choppy price action (low ADX + tight BB)
  ACCUMULATION 🧠 — Smart money quietly buying (low ATR + vol decline + price holding)
  DISTRIBUTION 📉 — Smart money offloading (price up + vol fading + RSI divergence)
"""

import pandas as pd
import numpy as np
import math


# ── Helpers ────────────────────────────────────────────────────────────────

def _s(val, default=0.0):
    """Safe float cast."""
    try:
        v = float(val)
        return default if math.isnan(v) or math.isinf(v) else v
    except (TypeError, ValueError):
        return default


def _compute_adx(df: pd.DataFrame, window: int = 14) -> dict:
    """
    Compute ADX, +DI, -DI from OHLC data inline (doesn't require pre-computed columns).
    Returns dict with keys: adx, plus_di, minus_di
    """
    if len(df) < window + 5:
        return {'adx': 0.0, 'plus_di': 0.0, 'minus_di': 0.0}

    high  = df['High']
    low   = df['Low']
    close = df['Close']

    # True Range
    hl  = high - low
    hpc = (high - close.shift()).abs()
    lpc = (low  - close.shift()).abs()
    tr  = pd.concat([hl, hpc, lpc], axis=1).max(axis=1)

    # Directional Movement
    up_move   = high.diff()
    down_move = (-low.diff())
    plus_dm   = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm  = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    plus_dm_s  = pd.Series(plus_dm,  index=df.index).rolling(window).sum()
    minus_dm_s = pd.Series(minus_dm, index=df.index).rolling(window).sum()
    tr_s       = tr.rolling(window).sum()

    plus_di  = (100 * plus_dm_s  / tr_s.replace(0, np.nan)).fillna(0)
    minus_di = (100 * minus_dm_s / tr_s.replace(0, np.nan)).fillna(0)

    dx_denom = (plus_di + minus_di).replace(0, np.nan)
    dx = (100 * (plus_di - minus_di).abs() / dx_denom).fillna(0)
    adx = dx.rolling(window).mean()

    return {
        'adx':      _s(adx.iloc[-1]),
        'plus_di':  _s(plus_di.iloc[-1]),
        'minus_di': _s(minus_di.iloc[-1]),
    }


def _compute_bb_width(df: pd.DataFrame, window: int = 20, num_std: float = 2.0) -> float:
    """Bollinger Band Width as fraction of price (normalized). Tighter = lower value."""
    if len(df) < window:
        return 0.05  # fallback neutral

    close  = df['Close']
    mid    = close.rolling(window).mean()
    std    = close.rolling(window).std()
    upper  = mid + num_std * std
    lower  = mid - num_std * std

    width_pct = ((upper - lower) / mid.replace(0, np.nan)).fillna(0)
    return _s(width_pct.iloc[-1])


def _compute_volume_trend(df: pd.DataFrame) -> str:
    """Compare short (10-bar) vs long (30-bar) volume SMA."""
    if len(df) < 30:
        return 'neutral'
    vol    = df['Volume']
    short  = _s(vol.rolling(10).mean().iloc[-1])
    long_  = _s(vol.rolling(30).mean().iloc[-1])
    if long_ == 0:
        return 'neutral'
    ratio = short / long_
    if ratio > 1.15:
        return 'expanding'
    elif ratio < 0.85:
        return 'contracting'
    return 'neutral'


def _compute_macd_slope(df: pd.DataFrame) -> float:
    """Return the 3-bar slope of the MACD histogram to detect momentum fade."""
    if 'MACD_Hist' in df.columns and len(df) >= 4:
        hist = df['MACD_Hist']
        slope = _s(hist.iloc[-1]) - _s(hist.iloc[-4])
        return slope
    if 'MACD' in df.columns and 'MACD_Signal' in df.columns and len(df) >= 4:
        hist = df['MACD'] - df['MACD_Signal']
        slope = _s(hist.iloc[-1]) - _s(hist.iloc[-4])
        return slope
    return 0.0


def _adx_strength(adx: float) -> str:
    if adx >= 35:   return 'strong'
    elif adx >= 25: return 'moderate'
    else:           return 'weak'


# ── Phase Metadata ─────────────────────────────────────────────────────────

PHASE_META = {
    'TRENDING': {
        'emoji':  '🔥',
        'label':  'Trending',
        'color':  'trending',
    },
    'RANGING': {
        'emoji':  '🟡',
        'label':  'Ranging',
        'color':  'ranging',
    },
    'ACCUMULATION': {
        'emoji':  '🧠',
        'label':  'Accumulation',
        'color':  'accumulation',
    },
    'DISTRIBUTION': {
        'emoji':  '📉',
        'label':  'Distribution',
        'color':  'distribution',
    },
}


# ── Main Detector ──────────────────────────────────────────────────────────

def detect_market_phase(df: pd.DataFrame, daily_df: pd.DataFrame = None) -> dict:
    """
    Detect the current market phase from OHLCV + indicator data.

    Priority waterfall:
      1. TRENDING     — ADX > 25 + SMA aligned + momentum present
      2. DISTRIBUTION — Price up + volume contracting + momentum fading
      3. ACCUMULATION — Price flat/up + volume contracting + low ATR + RSI mid-range
      4. RANGING      — Low ADX + narrow BB + no strong direction
    """
    fallback = {
        'phase': 'RANGING', 'phase_emoji': '🟡', 'phase_label': 'Ranging',
        'phase_direction': 'neutral', 'adx': 0.0, 'adx_strength': 'weak',
        'bb_width': 0.05, 'volume_trend': 'neutral', 'confidence': 30,
        'description': 'Insufficient data for phase detection.',
        'phase_color': 'ranging',
    }

    if df is None or df.empty or len(df) < 20:
        return fallback

    # ── 1. Gather signals ─────────────────────────────────────────────────
    latest  = df.iloc[-1]

    # ADX
    adx_data   = _compute_adx(df)
    adx        = adx_data['adx']
    plus_di    = adx_data['plus_di']
    minus_di   = adx_data['minus_di']

    # SMA alignment (use daily_df if available for stronger signal)
    ref_df   = daily_df if (daily_df is not None and len(daily_df) >= 50) else df
    close_r  = ref_df['Close']
    sma20    = _s(close_r.rolling(20).mean().iloc[-1])
    sma50    = _s(close_r.rolling(50).mean().iloc[-1]) if len(ref_df) >= 50 else sma20
    sma_bull = sma20 > sma50
    sma_bear = sma20 < sma50

    # Current price vs short SMA (chart timeframe)
    close_c  = df['Close']
    sma10    = _s(close_c.rolling(10).mean().iloc[-1])
    cur_price = _s(latest.get('Close', 0))
    price_above_sma10 = cur_price > sma10

    # ATR ratio (current vs 50-bar avg)
    if 'ATR' in df.columns and len(df) >= 14:
        cur_atr  = _s(df['ATR'].iloc[-1])
        avg_atr  = _s(df['ATR'][-50:].mean(), 1.0) or 1.0
        atr_ratio = max(0.1, min(3.0, cur_atr / avg_atr))
    else:
        atr_ratio = 1.0

    # RSI
    rsi = _s(latest.get('RSI', 50), 50)

    # BB Width
    bb_width = _compute_bb_width(df)

    # Volume Trend
    vol_trend = _compute_volume_trend(df)

    # Price trend (10-bar return)
    price_change_10 = 0.0
    if len(df) >= 11:
        p0 = _s(df['Close'].iloc[-11])
        p1 = _s(df['Close'].iloc[-1])
        price_change_10 = ((p1 - p0) / p0 * 100) if p0 != 0 else 0.0

    # MACD slope
    macd_slope = _compute_macd_slope(df)

    # Bearish divergence flag
    bearish_div = bool(latest.get('Bearish_Divergence', False))

    # ── 2. Phase Decision Waterfall ───────────────────────────────────────
    phase      = 'RANGING'
    direction  = 'neutral'
    confidence = 40
    reasons    = []

    # ── TRENDING ──────────────────────────────────────────────────────────
    if adx >= 25:
        phase = 'TRENDING'
        if plus_di > minus_di:
            direction = 'bullish'
        elif minus_di > plus_di:
            direction = 'bearish'
        else:
            direction = 'neutral'

        confidence = 50
        if adx >= 35:
            confidence += 20
            reasons.append(f'ADX at {adx:.1f} — strong directional trend.')
        else:
            confidence += 10
            reasons.append(f'ADX at {adx:.1f} — moderate trend confirmed.')

        if sma_bull and direction == 'bullish':
            confidence += 12
            reasons.append('SMA20 > SMA50 confirms bullish alignment.')
        elif sma_bear and direction == 'bearish':
            confidence += 12
            reasons.append('SMA20 < SMA50 confirms bearish alignment.')

        if vol_trend == 'expanding':
            confidence += 8
            reasons.append('Volume expanding — institutional participation.')

    # ── DISTRIBUTION ──────────────────────────────────────────────────────
    elif price_change_10 > 1.5 and vol_trend == 'contracting' and (macd_slope < 0 or bearish_div):
        phase     = 'DISTRIBUTION'
        direction = 'bearish'
        confidence = 52

        reasons.append(f'Price up {price_change_10:.1f}% while volume is contracting.')
        if macd_slope < 0:
            confidence += 10
            reasons.append('MACD histogram declining — momentum weakening.')
        if bearish_div:
            confidence += 10
            reasons.append('Bearish price-volume divergence confirmed.')
        if rsi > 60:
            confidence += 8
            reasons.append(f'RSI at {rsi:.1f} — elevated, distribution zone.')

    # ── ACCUMULATION ──────────────────────────────────────────────────────
    elif vol_trend == 'contracting' and atr_ratio < 0.9 and price_change_10 > -2.0 and rsi < 60:
        phase     = 'ACCUMULATION'
        direction = 'bullish'
        confidence = 50

        reasons.append('Volume quietly contracting with price holding up — accumulation pattern.')
        if atr_ratio < 0.7:
            confidence += 12
            reasons.append(f'ATR compressed to {atr_ratio:.2f}x avg — price coiling.')
        if bb_width < 0.04:
            confidence += 10
            reasons.append('Bollinger Bands squeezing — breakout imminent.')
        if rsi >= 40 and rsi <= 55:
            confidence += 8
            reasons.append(f'RSI neutral at {rsi:.1f} — no extreme exhaustion.')

    # ── RANGING ───────────────────────────────────────────────────────────
    else:
        phase     = 'RANGING'
        direction = 'neutral'
        confidence = 45

        reasons.append(f'ADX at {adx:.1f} — low directional momentum.')
        if bb_width < 0.04:
            confidence += 10
            reasons.append('Bollinger Bands tight — low volatility sideways chop.')
        if vol_trend == 'neutral':
            confidence += 5
            reasons.append('Volume neutral — no strong institutional conviction.')

    # ── 3. Clamp confidence ───────────────────────────────────────────────
    confidence = min(max(confidence, 25), 95)

    # ── 4. Human-readable description ─────────────────────────────────────
    desc_map = {
        'TRENDING': {
            'bullish': f'Strong bullish trend confirmed (ADX {adx:.0f}). Momentum is directional and expanding.',
            'bearish': f'Strong bearish trend confirmed (ADX {adx:.0f}). Sellers in control across timeframes.',
            'neutral': f'Trend active (ADX {adx:.0f}) but direction ambiguous — watch DI crossover.',
        },
        'RANGING': {
            'neutral': f'Price oscillating between support and resistance. ADX {adx:.0f} — no directional edge.',
            'bullish': f'Slight upward bias in range. Wait for breakout above resistance to confirm trend.',
            'bearish': f'Slight downward bias in range. Watch for breakdown below support.',
        },
        'ACCUMULATION': {
            'bullish': 'Smart money appears to be quietly accumulating. Volume declining, price stable — pre-breakout coil.',
            'neutral': 'Possible base-building phase. Low ATR and declining volume — institutional footprint forming.',
            'bearish': 'Possible accumulation after a drop. Capitulation drying up — watch for volume reversal.',
        },
        'DISTRIBUTION': {
            'bearish': 'Price rising but volume fading — classic distribution. Smart money may be offloading into strength.',
            'neutral': 'Momentum weakening at highs. Watch for volume spike reversal or MACD bearish cross.',
            'bullish': 'Mixed signals at high prices — possible re-accumulation or delayed distribution.',
        },
    }

    description = desc_map.get(phase, {}).get(direction, reasons[0] if reasons else 'Phase analysis complete.')

    meta = PHASE_META[phase]

    return {
        'phase':           phase,
        'phase_emoji':     meta['emoji'],
        'phase_label':     meta['label'],
        'phase_color':     meta['color'],
        'phase_direction': direction,
        'adx':             round(adx, 1),
        'adx_strength':    _adx_strength(adx),
        'bb_width':        round(bb_width * 100, 2),   # as % for display
        'atr_ratio':       round(atr_ratio, 2),
        'volume_trend':    vol_trend,
        'rsi':             round(rsi, 1),
        'confidence':      confidence,
        'description':     description,
        'signals':         reasons,
    }
