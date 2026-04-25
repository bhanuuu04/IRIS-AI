from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

def analyze_sentiment(news_headlines: list) -> dict:
    """
    Analyzes a list of news headlines using VADER sentiment analysis.
    Returns the average score, a classification string, and a formatted AI summary.
    """
    if not news_headlines:
        return {
            "score": 0.0,
            "classification": "NEUTRAL",
            "summary": "No recent news headlines available for sentiment analysis."
        }
        
    total_compound = 0
    analyzed_headlines = []
    
    for headline in news_headlines:
        # Some headlines might be dicts from yfinance
        text = headline.get('title', '') if isinstance(headline, dict) else str(headline)
        
        if not text:
            continue
            
        vs = analyzer.polarity_scores(text)
        total_compound += vs['compound']
        analyzed_headlines.append({
            "text": text,
            "score": vs['compound']
        })
        
    if not analyzed_headlines:
        return {
            "score": 0.0,
            "classification": "NEUTRAL",
            "summary": "No valid news headlines available for sentiment analysis."
        }

    avg_compound = total_compound / len(analyzed_headlines)
    
    if avg_compound >= 0.05:
        classification = "POSITIVE"
    elif avg_compound <= -0.05:
        classification = "NEGATIVE"
    else:
        classification = "NEUTRAL"
        
    # Generate human-like summary
    summary = generate_ai_summary(classification, avg_compound, len(analyzed_headlines))
    
    return {
        "score": round(avg_compound, 2),
        "classification": classification,
        "summary": summary,
        "details": analyzed_headlines
    }

def generate_ai_summary(classification: str, score: float, count: int) -> str:
    """Generates a template-based 'AI' summary of the sentiment."""
    intensity = "slightly"
    if abs(score) > 0.5:
        intensity = "strongly"
    
    if classification == "POSITIVE":
        return f"Based on {count} recent news headlines, the overall sentiment is {intensity} positive. This suggests favorable media coverage which often correlates with bullish short-term behavior."
    elif classification == "NEGATIVE":
        return f"Based on {count} recent news headlines, the overall sentiment is {intensity} negative. This suggests unfavorable media coverage which could introduce downward pressure or volatility."
    else:
        return f"Based on {count} recent news headlines, the overall sentiment is neutral. The media coverage does not indicate any strong directional bias."
