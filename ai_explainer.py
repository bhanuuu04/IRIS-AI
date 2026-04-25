"""
ai_explainer.py — IRIS Fast Narrative Engine
Generates instant, data-driven AI Insights and Reasoning Engine output
without any external API calls. Completely local and blazing fast.
"""
import math
import random

FALLBACK = "Analysis indicates notable market activity based on recent price and volume behaviour."

def _safe_float(v, default=0.0):
    try:
        f = float(v)
        return default if math.isnan(f) or math.isinf(f) else round(f, 2)
    except Exception:
        return default

# ─── Keep _build_prompt for legacy compatibility (not called anymore) ────────
def _build_prompt(market_data: dict, pro_mode: bool) -> str:
    return ""

# ─── Main Engine ─────────────────────────────────────────────────────────────
def get_ai_explanation(market_data: dict, pro_mode: bool = False) -> str:
    import random
    symbol       = market_data.get("symbol", "Asset")
    trend        = market_data.get("long_term_trend", "neutral")
    price_change = _safe_float(market_data.get("price_change_pct", 0.0))
    range_pct    = _safe_float(market_data.get("range_percent", 0.0))
    volatility   = market_data.get("volatility_level", "medium")
    vol_level    = market_data.get("volume_level", "avg")
    rsi          = _safe_float(market_data.get("rsi", 50.0))
    score        = int(market_data.get("risk_score", 50))
    conf         = int(market_data.get("confidence", 50))
    macd         = market_data.get("macd_signal", "neutral")
    price_z      = _safe_float(market_data.get("price_z", 0.0))
    vol_z        = _safe_float(market_data.get("volume_z", 0.0))

    change_abs = abs(price_change)
    direction  = "higher" if price_change >= 0 else "lower"

    # ── RSI label helper ─────────────────────────────────────────────────────
    if rsi >= 80:   rsi_lbl = "severely overbought"
    elif rsi >= 70: rsi_lbl = "overbought"
    elif rsi <= 20: rsi_lbl = "deeply oversold"
    elif rsi <= 30: rsi_lbl = "oversold"
    elif rsi >= 55: rsi_lbl = "moderately bullish"
    elif rsi <= 45: rsi_lbl = "moderately bearish"
    else:           rsi_lbl = "neutral"

    # ════════════════════════════════════════════════════════════════════════
    # 1. DEEP SCAN NARRATIVE
    # ════════════════════════════════════════════════════════════════════════
    if trend == "uptrend":
        s1 = random.choice([
            f"{symbol} is demonstrating sustained bullish structure, advancing {change_abs:.2f}% within a {range_pct:.2f}% channel.",
            f"Price action for {symbol} reflects steady upward momentum with a {change_abs:.2f}% gain and {range_pct:.2f}% range.",
            f"{symbol} maintains a constructive uptrend, pushing {direction} by {change_abs:.2f}% as bulls maintain control."
        ])
    elif trend == "downtrend":
        s1 = random.choice([
            f"{symbol} remains under distribution pressure, declining {change_abs:.2f}% as sellers dominate the {range_pct:.2f}% range.",
            f"Bearish market structure persists for {symbol}, marked by a {change_abs:.2f}% pullback and volatility expansion.",
            f"{symbol} is navigating a confirmed downtrend, shedding {change_abs:.2f}% within a controlled {range_pct:.2f}% band."
        ])
    else:
        s1 = random.choice([
            f"{symbol} is currently range-bound, oscillating within a tight {range_pct:.2f}% boundary with low directional conviction.",
            f"Consolidating price action characterizes {symbol}, forming a {range_pct:.2f}% compression zone ahead of the next move.",
            f"{symbol} exhibits muted directional bias, trading within a narrow {range_pct:.2f}% channel with {change_abs:.2f}% drift."
        ])

    if vol_level == "above avg":
        s2 = f"This move is backed by elevated participation (Volume Z: {vol_z:.1f}), suggesting institutional involvement."
    elif vol_level == "below avg":
        s2 = f"Muted volume (Volume Z: {vol_z:.1f}) suggests a lack of conviction; this move may be a low-liquidity drift."
    else:
        s2 = f"Trading volume remains average (Volume Z: {vol_z:.1f}), aligning with typical session participation."

    if rsi >= 70:
        s3 = f"RSI at {rsi:.1f} ({rsi_lbl}) signals exhaustion, hinting at a potential near-term cooldown or retracement."
    elif rsi <= 30:
        s3 = f"Deep oversold conditions (RSI {rsi:.1f}) suggest downside momentum may be fading as buyers begin to step in."
    else:
        s3 = f"A neutral RSI of {rsi:.1f} gives {symbol} room to maneuver without immediate overextended pressure."

    s4 = random.choice([
        "Expect continued accumulation if key support levels hold.",
        "Wait for a decisive breakout with volume confirmation to validate the next directional leg.",
        "The path of least resistance remains aligned with the broader structural trend."
    ])

    deep_scan = f"{s1} {s2} {s3} {s4}"
    if not pro_mode: return deep_scan

    # ════════════════════════════════════════════════════════════════════════
    # 2. REASONING ENGINE (Pro Mode)
    # ════════════════════════════════════════════════════════════════════════
    
    # Market Context
    if trend == "uptrend":
        if rsi < 45: ctx = f"{symbol} maintains its long-term bullish bias, but the recent {change_abs:.2f}% dip indicates a healthy shakeout or pullback within the trend."
        else: ctx = f"{symbol} is trading with strong bullish continuity, currently up {price_change:.2f}% and holding well above key structural support."
    elif trend == "downtrend":
        if rsi > 55: ctx = f"While {symbol} is structurally bearish, the current relief rally (RSI {rsi:.1f}) suggests a temporary short-squeeze within a larger downtrend."
        else: ctx = f"{symbol} is locked in a bearish cycle, with consistent lower highs and price action down {change_abs:.2f}% in the current window."
    else:
        ctx = f"{symbol} is in a period of price discovery/consolidation, trading within a {range_pct:.2f}% range with no dominant trend in control."

    # Key Insight
    if rsi <= 25: insight = f"Critical RSI extreme ({rsi:.1f}) detected. The asset is historically overstretched to the downside, often a precursor to a mean-reversion bounce."
    elif rsi >= 75: insight = f"Overbought RSI ({rsi:.1f}) combined with high volatility suggests a blow-off top or exhaustion phase is approaching."
    elif abs(price_z) > 2.0: insight = f"Statistically rare price deviation (Z-Score {price_z:.1f}) indicates a major liquidity event or breakout is occurring."
    elif macd != "neutral": insight = f"The {macd} signals a shift in momentum structure, potentially marking the beginning of a new directional leg."
    else: insight = f"Momentum remains balanced (RSI {rsi:.1f}). The primary insight is the lack of momentum divergence, keeping the current range intact."

    # Conflict Resolution
    if trend == "uptrend" and rsi < 40: conflict = f"Conflict: Bullish macro trend vs Bearish micro momentum. This typically resolves as a 'buy the dip' opportunity if support holds."
    elif trend == "downtrend" and rsi > 60: conflict = f"Conflict: Bearish macro trend vs Bullish micro momentum. Likely a 'fade the rally' scenario unless structure is broken."
    elif vol_level == "above avg" and price_change < 0.5: conflict = f"High volume (Z {vol_z:.1f}) but little price movement indicates heavy absorption or distribution taking place."
    else: conflict = "Indicator alignment: All major signals (Trend, RSI, Volume) are currently in sync with the prevailing price direction."

    # Scenarios
    if trend == "uptrend":
        scen_bull = f"Hold above current levels + RSI recovery above 50 → Target new highs."
        scen_bear = f"Break below recent lows on high volume → Invalidation of the bullish thesis."
    elif trend == "downtrend":
        scen_bull = f"Aggressive reclaim of 50-period EMA + volume surge → Potential trend reversal."
        scen_bear = f"Failure to bounce at oversold levels → Further liquidation towards the next support zone."
    else:
        scen_bull = f"Breakout above the {range_pct:.2f}% range resistance → Bullish trend initiation."
        scen_bear = f"Breakdown below range floor → Continuation of the previous bearish cycle."

    # Key Driver
    if vol_level == "above avg": driver = f"Institutional flow (Volume Z {vol_z:.1f}) is the primary driver of the current {direction} movement."
    elif abs(price_z) > 1.5: driver = f"Momentum velocity (Price Z {price_z:.1f}) is driving the current price action, outpacing typical volatility."
    else: driver = f"The broader {trend} is the primary driver, with price action following macro structural flows."

    # Conclusion
    if score > 70: conclusion = f"High risk detected ({score}/100). Exercise extreme caution; current conditions are unfavorable for new positions."
    elif trend == "uptrend" and rsi < 50: conclusion = "Bias remains bullish but wait for a clear bounce and RSI recovery before considering entries."
    elif trend == "downtrend": conclusion = "Bias remains bearish. Avoid catching falling knives; look for structural shorts on relief rallies."
    else: conclusion = "Neutral/Balanced bias. Wait for a clear catalyst or range breakout to define the next trade setup."

    conf_score = round(conf / 10, 1)

    reasoning_engine = (
        f"Market Context:\n{ctx}\n\n"
        f"Key Insight:\n{insight}\n\n"
        f"Conflict Resolution:\n{conflict}\n\n"
        f"Scenarios:\n"
        f"🟢 Bullish: {scen_bull}\n"
        f"🔴 Bearish: {scen_bear}\n\n"
        f"Key Driver:\n{driver}\n\n"
        f"Conclusion:\n{conclusion}\n\n"
        f"Confidence: {conf_score}/10 (Based on {volatility} volatility data)"
    )

    return f"==== DEEP SCAN ====\n{deep_scan}\n==== REASONING ENGINE ====\n{reasoning_engine}"
