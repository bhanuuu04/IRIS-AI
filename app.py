from flask import Flask, jsonify, send_from_directory, request
from flask_caching import Cache
from data_fetcher import fetch_dual_data, fetch_news
from indicators import add_all_indicators
from analyzer import analyze_risk
from pro_analyzer import deep_analyze
from sentiment_ai import analyze_sentiment
from ai_explainer import get_ai_explanation
from market_phase import detect_market_phase
import chart_intel
import os
import json
import pandas as pd
import requests
import pytz
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
EXECUTOR = ThreadPoolExecutor(max_workers=10)

app = Flask(__name__)

# Cache configuration
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300   # 5 minutes
cache = Cache(app)


@app.route('/')
def index():
    return {"status": "IRIS AI Backend Online", "version": "1.0"}, 200


@app.route('/api/analyze/<symbol>', methods=['GET'])
def analyze_symbol(symbol):
    try:
        interval = request.args.get('interval', '15m')
        pro_mode = request.args.get('pro', 'false').lower() == 'true'

        # Normal mode uses cache (keyed by symbol + interval)
        if not pro_mode:
            cache_key = f'analyze_{symbol}_{interval}'
            cached = cache.get(cache_key)
            if cached:
                return jsonify(cached)

        # ── 1. Start News Fetch in Background ────────────────────────────
        news_future = EXECUTOR.submit(fetch_news, symbol, 12)

        # ── 2. Dual-pipeline data fetch ───────────────────────────────────
        dual = fetch_dual_data(symbol, interval=interval, pro_mode=pro_mode)

        chart_df    = dual['chart_df']
        intraday_df = dual['intraday_df']   # None for daily/weekly
        daily_df    = dual['daily_df']
        is_intraday = dual['is_intraday']

        if chart_df is None or chart_df.empty:
            err_msg = dual.get('error') or f'Could not fetch data for {symbol.upper()}'
            return jsonify({'error': True, 'reasons': [err_msg]}), 404

        # ── 2. Run indicators separately on both dataframes ───────────────
        chart_with_ind = add_all_indicators(chart_df)

        daily_with_ind = None
        if daily_df is not None and not daily_df.empty:
            # Cache daily indicators (expensive) separately
            daily_cache_key = f'daily_ind_{symbol}'
            daily_with_ind = cache.get(daily_cache_key) if not pro_mode else None
            if daily_with_ind is None:
                daily_with_ind = add_all_indicators(daily_df)
                if not pro_mode:
                    cache.set(daily_cache_key, daily_with_ind, timeout=600)  # 10 min

        # ── 3. Analysis — pass both dataframes ────────────────────────────
        # For intraday: use chart_with_ind for short-term, daily_with_ind for context
        # For daily/weekly: chart_with_ind IS the daily data; no separate intraday
        if pro_mode:
            analysis_df = chart_with_ind
            risk_result = deep_analyze(analysis_df, daily_with_ind)
        else:
            analysis_df = chart_with_ind
            # For daily/weekly intervals, chart IS daily — no need for separate daily context
            ctx_daily = daily_with_ind if is_intraday else chart_with_ind
            risk_result = analyze_risk(analysis_df, ctx_daily)
            risk_result['mode']           = 'NORMAL'
            risk_result['depth']          = 'standard'
            risk_result['signal_strength'] = 'moderate'

        # ── 3b. Market Phase Detection (always-on, no API) ────────────────
        market_phase_result = detect_market_phase(chart_with_ind, daily_with_ind)

        # ── 4. Parallel: Sentiment + Narrative Engine ────────────────
        # Extract real indicator values from the chart dataframe
        def _sf(v, d=0.0):
            """Safe float extraction from pandas scalar."""
            try:
                import math
                f = float(v)
                return d if math.isnan(f) or math.isinf(f) else round(f, 4)
            except Exception:
                return d

        latest_row   = chart_with_ind.iloc[-1]
        prev_row     = chart_with_ind.iloc[-2] if len(chart_with_ind) >= 2 else latest_row
        cur_price    = _sf(latest_row.get('Close', 0))
        prev_price   = _sf(prev_row.get('Close', cur_price))
        pct_change   = ((cur_price - prev_price) / prev_price * 100) if prev_price != 0 else 0.0
        rsi_val      = _sf(latest_row.get('RSI', 50), 50.0)
        macd_val     = _sf(latest_row.get('MACD', 0))
        macd_sig_val = _sf(latest_row.get('MACD_Signal', 0))
        price_z_val  = _sf(latest_row.get('Price_Z_Score', 0))
        vol_z_val    = _sf(latest_row.get('Volume_Z_Score', 0))

        macd_signal_label = (
            'bullish crossover' if macd_val > macd_sig_val
            else 'bearish crossover' if macd_val < macd_sig_val
            else 'neutral'
        )

        long_trend = 'neutral'
        if daily_with_ind is not None and len(daily_with_ind) >= 50:
            sma20 = daily_with_ind['Close'].rolling(20).mean().iloc[-1]
            sma50 = daily_with_ind['Close'].rolling(50).mean().iloc[-1]
            if _sf(sma50) > 0:
                diff = (_sf(sma20) - _sf(sma50)) / _sf(sma50) * 100
                long_trend = 'uptrend' if diff > 1.5 else ('downtrend' if diff < -1.5 else 'sideways')

        cur_high = _sf(latest_row.get('High', cur_price))
        cur_low  = _sf(latest_row.get('Low', cur_price))
        range_percent = ((cur_high - cur_low) / cur_low * 100) if cur_low > 0 else 0.0

        volatility_level = 'high' if abs(price_z_val) > 2 else ('low' if abs(price_z_val) < 0.5 else 'medium')
        volume_level = 'above avg' if vol_z_val > 1.5 else ('below avg' if vol_z_val < -0.5 else 'avg')

        market_data_for_narrative = {
            'symbol':              symbol.upper(),
            'interval':            interval,
            'is_intraday':         is_intraday,
            'current_price':       cur_price,
            'price_change_pct':    round(pct_change, 3),
            'rsi':                 rsi_val,
            'macd_signal':         macd_signal_label,
            'price_z':             price_z_val,
            'volume_z':            vol_z_val,
            'long_term_trend':     long_trend,
            'range_percent':       round(range_percent, 2),
            'volatility_level':    volatility_level,
            'volume_level':        volume_level,
            'risk_score':          risk_result.get('risk_score', 0),
            'risk_level':          risk_result.get('risk_level', 'UNKNOWN'),
            'confidence':          risk_result.get('confidence', 0),
            'patterns':            risk_result.get('pattern_detected', []),
            'signals_text':        risk_result.get('explanation', ''),
            'signal_strength':     risk_result.get('signal_strength', 'moderate'),
            'multi_timeframe_note': risk_result.get('multi_timeframe_note', ''),
            'sentiment':           'NEUTRAL',  # will update after news fetch
            'market_phase':        market_phase_result.get('phase', 'RANGING'),
            'phase_direction':     market_phase_result.get('phase_direction', 'neutral'),
        }

        # ── 4. Collect News & Run Sentiment ──────────────────────────────
        try:
            news_headlines = news_future.result(timeout=10)
        except Exception:
            news_headlines = []
        
        sentiment_result = analyze_sentiment(news_headlines)
        real_sentiment   = sentiment_result.get('classification', 'NEUTRAL')
        market_data_for_narrative['sentiment'] = real_sentiment

        if real_sentiment == 'NEGATIVE':
            risk_result['risk_score'] = min(risk_result['risk_score'] + 10, 100)

        # ── 5. Chart payload — strictly from chart_df (user-selected interval)
        chart_limit = 250 if pro_mode else 150
        historical_data = []
        for date, row in chart_with_ind.tail(chart_limit).iterrows():
            historical_data.append({
                'time':   int(date.timestamp()) if hasattr(date, 'timestamp') else str(date),
                'open':   None if pd.isna(row['Open'])   else float(row['Open']),
                'high':   None if pd.isna(row['High'])   else float(row['High']),
                'low':    None if pd.isna(row['Low'])    else float(row['Low']),
                'close':  None if pd.isna(row['Close'])  else float(row['Close']),
                'volume': None if pd.isna(row['Volume']) else float(row['Volume']),
            })

        currency = 'INR' if (symbol.upper().endswith('.NS') or symbol.upper().endswith('.BO')) else 'USD'

        risk_result['timeframe_meta'] = {
            'selected_interval': interval,
            'is_intraday':       is_intraday,
            'analysis_context':  'dual' if (is_intraday and daily_with_ind is not None) else 'single',
            'chart_candles':     len(historical_data),
            'daily_candles':     len(daily_df) if daily_df is not None else 0,
        }
        
        # We no longer block on AI explanation here. 
        # The frontend will fetch it asynchronously using the ai_prompt_data.

        response_payload = {
            'symbol':          symbol.upper(),
            'currency':        currency,
            'market_session':  get_market_session(symbol.upper()),
            'risk':            risk_result,
            'sentiment':       sentiment_result,
            'market_phase':    market_phase_result,
            'historical_data': historical_data,
            'ai_prompt_data':  market_data_for_narrative,
            'chart_intel': {
                'markers': chart_intel.get_anomaly_markers(chart_with_ind),
                'zones': chart_intel.get_breakout_zones(chart_with_ind)
            }
        }

        # Cache normal mode result
        if not pro_mode:
            cache.set(f'analyze_{symbol}_{interval}', response_payload, timeout=300)

        return jsonify(response_payload)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': True, 'reasons': [f'Internal error: {str(e)}']}), 500


@app.route('/api/top_risky', methods=['GET'])
@cache.cached(timeout=600)
def top_risky():
    mock_data = [
        {'symbol': 'RELIANCE.NS', 'risk_score': 85, 'risk_level': 'HIGH',   'reasons': ['High Volatility', 'Sentiment Negative']},
        {'symbol': 'TCS.NS',      'risk_score': 78, 'risk_level': 'HIGH',   'reasons': ['Price Divergence', 'Volume Spike']},
        {'symbol': '^NSEI',       'risk_score': 45, 'risk_level': 'MEDIUM', 'reasons': ['Overbought RSI', 'Strong Momentum']},
        {'symbol': 'HDFCBANK.NS', 'risk_score': 90, 'risk_level': 'HIGH',   'reasons': ['Extreme Volume Anomaly', 'Z-Score > 3']},
    ]
    return jsonify(mock_data)


def get_market_session(symbol):
    symbol_upper = symbol.upper()
    is_nse    = symbol_upper.endswith('.NS') or symbol_upper.endswith('.BO') or symbol_upper == '^NSEI'
    is_crypto = '-' in symbol_upper and any(symbol_upper.endswith(x) for x in ('-USD', '-EUR', '-INR'))
    is_forex  = symbol_upper.endswith('=X')

    if is_crypto:
        return {'status': 'OPEN (24/7)', 'time_remaining': 'Never closes'}

    now_utc = datetime.now(pytz.utc)
    is_weekend = now_utc.weekday() >= 5

    if is_forex:
        if is_weekend:
            return {'status': 'CLOSED (Weekend)', 'time_remaining': 'Opens Monday'}
        return {'status': 'OPEN (24/5)', 'time_remaining': 'Forex Market'}

    if is_nse:
        tz = pytz.timezone('Asia/Kolkata')
        now = datetime.now(tz)
        open_time  = now.replace(hour=9,  minute=15, second=0, microsecond=0)
        close_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
    else:
        tz = pytz.timezone('America/New_York')
        now = datetime.now(tz)
        open_time  = now.replace(hour=9,  minute=30, second=0, microsecond=0)
        close_time = now.replace(hour=16, minute=0,  second=0, microsecond=0)

    if now.weekday() >= 5:
        return {'status': 'CLOSED (Weekend)', 'time_remaining': 'Opens Monday'}

    if now < open_time:
        diff = open_time - now
        h, rem = divmod(diff.seconds, 3600)
        m, _   = divmod(rem, 60)
        return {'status': 'PRE-MARKET', 'time_remaining': f'Opens in {h}h {m}m'}
    elif now > close_time:
        return {'status': 'CLOSED', 'time_remaining': 'Opens tomorrow'}
    else:
        diff = close_time - now
        h, rem = divmod(diff.seconds, 3600)
        m, _   = divmod(rem, 60)
        return {'status': 'OPEN', 'time_remaining': f'Closes in {h}h {m}m'}


@app.route('/api/search', methods=['GET'])
def search_symbol():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    try:
        url     = f'https://query2.finance.yahoo.com/v1/finance/search?q={query}'
        headers = {'User-Agent': 'Mozilla/5.0'}
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data    = r.json()
            quotes  = data.get('quotes', [])
            results = [
                {'symbol': q['symbol'], 'name': q['shortname'], 'exchange': q.get('exchange', 'Unknown')}
                for q in quotes if 'symbol' in q and 'shortname' in q
            ]
            results.sort(key=lambda x: 0 if x['symbol'].endswith('.NS') or x['symbol'].endswith('.BO') else 1)
            return jsonify(results[:10])
        return jsonify([])
    except Exception as e:
        print(f'[Search] Error: {e}')
        return jsonify([])


@app.route('/api/generate_insight', methods=['POST'])
def generate_insight():
    try:
        payload = request.json
        if not payload or 'market_data' not in payload:
            return jsonify({'error': 'Missing market_data'}), 400
            
        pro_mode = request.args.get('pro', 'false').lower() == 'true'
        market_data = payload['market_data']
        
        # Call the actual AI logic
        ai_explanation = get_ai_explanation(market_data, pro_mode)
        
        if pro_mode:
            try:
                if "==== REASONING ENGINE ====" in ai_explanation:
                    parts = ai_explanation.split("==== REASONING ENGINE ====")
                    deep_scan_part = parts[0].replace("==== DEEP SCAN ====", "").strip()
                    reasoning_part = parts[1].strip()
                    return jsonify({'deep_scan': deep_scan_part, 'reasoning_engine': reasoning_part})
                else:
                    return jsonify({'deep_scan': ai_explanation, 'reasoning_engine': '⚠️ Reasoning Engine data could not be parsed from response.'})
            except Exception as e:
                print(f"Failed to parse Narrative text response: {e}")
                return jsonify({'deep_scan': ai_explanation, 'reasoning_engine': '⚠️ Analysis generated but could not be formatted properly.'})
        else:
            return jsonify({'explanation': ai_explanation})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    app.run(debug=True, port=5000)
