document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const searchForms = document.querySelectorAll('.search-form');
    
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    // Views
    const viewDashboard = document.getElementById('view-dashboard');
    const viewDetail = document.getElementById('view-detail');
    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalysis = document.getElementById('nav-analysis');
    const navSearchContainer = document.getElementById('nav-search-container');

    // Detail View Elements
    const riskCard = document.getElementById('risk-card');
    const resultSymbol = document.getElementById('result-symbol');
    const riskBadge = document.getElementById('risk-badge');
    const riskScore = document.getElementById('risk-score');
    const confidenceScore = document.getElementById('confidence-score');
    const reasonsList = document.getElementById('reasons-list');
    const suggestionText = document.getElementById('suggestion-text');
    const progressRingCircle = document.getElementById('progress-ring-circle');
    const btnWatchlistToggle = document.getElementById('btn-watchlist-toggle');
    
    const sentimentBadge = document.getElementById('sentiment-badge');
    const aiSummaryText = document.getElementById('ai-summary-text');
    const newsFeed = document.getElementById('news-feed');
    const chartContainer = document.getElementById('tv-chart');
    const searchSuggestions = document.getElementById('search-suggestions');

    let tvChart = null;
    let candlestickSeries = null;
    let currentInterval = '15m';   // default timeframe
    let isProMode = false;
    let _typewriterTimer = null;   // track active typewriter so we can cancel it

    // --- PRO MODE ---
    const proToggle  = document.getElementById('pro-mode-toggle');
    const proOverlay = document.getElementById('pro-mode-overlay');
    
    // --- Drawing State ---
    let drawings = []; 
    let activeTool = 'pointer';
    let drawingPoints = [];
    let tempSeries = null; 
    let currentSymbol = '';
    let selectedDrawing = null;
    let isDragging = false;
    let dragStart = null;

    function updateChartLock() {
        if (!tvChart) return;
        const isDrawingTool = activeTool === 'trendline' || activeTool === 'horizline';
        const isSelected = selectedDrawing !== null;
        
        tvChart.applyOptions({
            handleScroll: !(isDrawingTool || isSelected),
            handleScale: !(isDrawingTool || isSelected)
        });
    }

    proToggle.addEventListener('click', async () => {
        if (!isProMode) {
            // We are trying to turn it ON. Check subscription first.
            const btnText = proToggle.querySelector('span');
            const originalText = btnText ? btnText.textContent : 'PRO MODE';
            if (btnText) btnText.textContent = 'Checking...';
            proToggle.style.pointerEvents = 'none';

            try {
                const res = await fetch('/api/user/subscription');
                const data = await res.json();

                if (!data.active) {
                    // Not subscribed! Redirect to /pro with cinematic animation
                    document.body.style.transition = 'opacity 0.8s ease-in-out';
                    document.body.style.opacity = '0';
                    // We need to message the parent window (Next.js) to navigate since this is in an iframe
                    window.parent.postMessage({ type: 'NAVIGATE', path: '/pro' }, '*');
                    
                    // Fallback if iframe messaging isn't set up
                    setTimeout(() => {
                        window.top.location.href = '/pro';
                    }, 800);
                    return;
                }
                
                // Subscription active! Proceed with turning it on.
            } catch (err) {
                console.error("Subscription check failed", err);
                if (btnText) btnText.textContent = originalText;
                proToggle.style.pointerEvents = 'auto';
                return;
            }

            if (btnText) btnText.textContent = originalText;
            proToggle.style.pointerEvents = 'auto';
        }

        isProMode = !isProMode;
        proToggle.classList.toggle('active', isProMode);
        document.body.classList.toggle('pro-mode-active', isProMode);

        if (isProMode) {
            // Show cinematic overlay
            proOverlay.classList.remove('hidden', 'fade-out');
            // Restart bar animation by cloning
            const barFill = proOverlay.querySelector('.pro-overlay-bar-fill');
            const newBar  = barFill.cloneNode(true);
            barFill.parentNode.replaceChild(newBar, barFill);

            setTimeout(() => {
                proOverlay.classList.add('fade-out');
                setTimeout(() => proOverlay.classList.add('hidden'), 500);
            }, 1800);
        }
    });

    // --- Initialization ---
    initDashboard();
    initTimeframeToggles();
    initDrawingTools();
    initFullscreen();

    // --- Navigation ---
    navDashboard.addEventListener('click', () => {
        navDashboard.classList.add('active');
        navAnalysis.classList.remove('active');
        viewDashboard.classList.remove('hidden');
        viewDetail.classList.add('hidden');
        errorContainer.classList.add('hidden');
        navSearchContainer.style.display = 'none';
    });

    // --- Progress Ring ---
    const radius = progressRingCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressRingCircle.style.strokeDashoffset = circumference;

    function setProgress(percent, level) {
        const offset = circumference - (percent / 100) * circumference;
        progressRingCircle.style.strokeDashoffset = offset;
        
        if (level === 'HIGH') progressRingCircle.style.stroke = 'var(--risk-high)';
        else if (level === 'MEDIUM') progressRingCircle.style.stroke = 'var(--risk-medium)';
        else progressRingCircle.style.stroke = 'var(--risk-low)';
    }

    async function initDashboard() {
        const topRiskyList = document.getElementById('top-risky-list');
        const watchlistContainer = document.getElementById('watchlist-container');
        
        // 1. Fetch Top Risky
        try {
            const res = await fetch('/api/top_risky');
            const data = await res.json();
            
            topRiskyList.innerHTML = '';
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'risky-item';
                div.innerHTML = `
                    <div>
                        <div class="risky-symbol">${item.symbol}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary)">Score: ${item.risk_score}</div>
                    </div>
                    <div class="risk-badge risk-${item.risk_level.toLowerCase()}-bg">${item.risk_level}</div>
                `;
                div.addEventListener('click', () => {
                    document.querySelectorAll('.search-input').forEach(i => i.value = item.symbol);
                    searchForms[0].dispatchEvent(new Event('submit'));
                });
                topRiskyList.appendChild(div);
            });
        } catch (e) {
            topRiskyList.innerHTML = '<p>Could not load data.</p>';
        }

        // 2. Fetch Watchlist
        const savedSymbols = getWatchlist();
        if (savedSymbols.length === 0) {
            watchlistContainer.innerHTML = '<div class="watchlist-empty"><p>No assets saved yet. Search for a symbol to add it.</p></div>';
        } else {
            watchlistContainer.innerHTML = '';
            savedSymbols.forEach(async (symbol) => {
                const div = document.createElement('div');
                div.className = 'watchlist-item';
                div.innerHTML = `<div class="spinner" style="width: 15px; height: 15px; border-width: 2px;"></div> <span style="font-weight:600;">${symbol}</span>`;
                watchlistContainer.appendChild(div);
                
                try {
                    const res = await fetch(`/api/analyze/${symbol}`);
                    const data = await res.json();
                    if (!data.error) {
                        div.innerHTML = `
                            <div>
                                <div class="watchlist-symbol">${data.symbol}</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary)">Score: ${data.risk.risk_score}</div>
                            </div>
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <div class="risk-badge risk-${data.risk.risk_level.toLowerCase()}-bg">${data.risk.risk_level}</div>
                                <button class="remove-btn" title="Remove from Watchlist">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        `;
                        div.addEventListener('click', (e) => {
                            if (e.target.closest('.remove-btn')) {
                                toggleWatchlist(data.symbol);
                                initDashboard();
                                return;
                            }
                            document.querySelectorAll('.search-input').forEach(i => i.value = data.symbol);
                            searchForms[0].dispatchEvent(new Event('submit'));
                        });
                    } else {
                        div.innerHTML = `<span>${symbol}</span> <span style="color:var(--risk-high)">Error</span>`;
                    }
                } catch (e) {
                    div.innerHTML = `<span>${symbol}</span> <span style="color:var(--risk-high)">Error</span>`;
                }
            });
        }
    }

    // --- Form Submission & Autocomplete ---
    searchForms.forEach(form => {
        const input = form.querySelector('.search-input');
        const suggestionsBox = form.nextElementSibling; 
        const btnText = form.querySelector('.btn-text');
        const spinner = form.querySelector('.spinner');
        const analyzeBtn = form.querySelector('button[type="submit"]');

        let debounceTimer;
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            if (query.length < 2) {
                suggestionsBox.classList.add('hidden');
                return;
            }
            debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    if (data.length > 0) {
                        suggestionsBox.innerHTML = '';
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.innerHTML = `<div><span class="suggestion-symbol">${item.symbol}</span><span class="suggestion-name">${item.name || ''}</span></div><span class="suggestion-exchange">${item.exchange}</span>`;
                            div.addEventListener('click', () => {
                                document.querySelectorAll('.search-input').forEach(i => i.value = item.symbol);
                                suggestionsBox.classList.add('hidden');
                                form.dispatchEvent(new Event('submit'));
                            });
                            suggestionsBox.appendChild(div);
                        });
                        suggestionsBox.classList.remove('hidden');
                    } else {
                        suggestionsBox.classList.add('hidden');
                    }
                } catch (err) { console.error("Search API error", err); }
            }, 300);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const symbol = input.value.trim().toUpperCase();
            if (!symbol) return;
            
            // Sync all inputs
            document.querySelectorAll('.search-input').forEach(i => i.value = symbol);

            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            analyzeBtn.disabled = true;
            errorContainer.classList.add('hidden');
            progressRingCircle.style.strokeDashoffset = circumference;
            suggestionsBox.classList.add('hidden');

            // PRO mode loading label
            if (isProMode) {
                spinner.insertAdjacentHTML('afterend', '<span id="pro-scan-label" style="font-size:0.75rem;color:#a78bfa;margin-left:0.5rem;letter-spacing:1px;">Running Deep Scan...</span>');
            }

            try {
                const url = `/api/analyze/${symbol}?interval=${currentInterval}${isProMode ? '&pro=true' : ''}`;
                const response = await fetch(url);
                const data = await response.json();
                if (response.ok && !data.error) {
                    navAnalysis.classList.add('active');
                    navDashboard.classList.remove('active');
                    viewDashboard.classList.add('hidden');
                    viewDetail.classList.remove('hidden');
                    navSearchContainer.style.display = 'block';

                    // Apply/remove PRO glow on detail view
                    const vd = document.getElementById('view-detail');
                    if (data.risk && data.risk.mode === 'PRO') {
                        vd.classList.add('pro-mode-active');
                    } else {
                        vd.classList.remove('pro-mode-active');
                    }
                    
                    displayDetailView(data);
                    if (tvChart) tvChart.resize(chartContainer.clientWidth, 450);
                } else {
                    showError(data.reasons ? data.reasons[0] : 'An unknown error occurred.');
                }
            } catch (error) {
                showError('Error: Network error. Please make sure the server is running.');
            } finally {
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
                analyzeBtn.disabled = false;
                const lbl = document.getElementById('pro-scan-label');
                if (lbl) lbl.remove();
            }
        });
    });

    document.addEventListener('click', (e) => {
        document.querySelectorAll('.search-suggestions').forEach(box => {
            const form = box.previousElementSibling;
            if (!form.contains(e.target) && !box.contains(e.target)) {
                box.classList.add('hidden');
            }
        });
    });

    function showError(msg) {
        errorMessage.textContent = msg;
        errorContainer.classList.remove('hidden');
    }

    // --- Detail View Population ---
    function displayDetailView(data) {
        const { risk, sentiment, historical_data, symbol, currency, market_session } = data;
        
        // Market Session Widget
        const sessionDot = document.getElementById('session-dot');
        const sessionText = document.getElementById('session-text');
        const sessionTime = document.getElementById('session-time');
        
        sessionDot.className = 'session-dot';
        if (market_session) {
            if (market_session.status.includes('OPEN')) sessionDot.classList.add('open');
            else if (market_session.status.includes('PRE')) sessionDot.classList.add('pre');
            else sessionDot.classList.add('closed');
            
            sessionText.textContent = market_session.status;
            sessionTime.textContent = market_session.time_remaining;
        }
        
        // 1. Risk Score Card
        riskCard.className = 'risk-card glass-panel';
        riskBadge.className = 'risk-badge';
        resultSymbol.textContent = symbol;
        riskBadge.textContent = risk.risk_level;

        // Watchlist Button State
        const currentBtn = document.getElementById('btn-watchlist-toggle');
        if (getWatchlist().includes(symbol)) {
            currentBtn.classList.add('active');
        } else {
            currentBtn.classList.remove('active');
        }
        // Remove old listeners by replacing clone
        const newBtn = currentBtn.cloneNode(true);
        currentBtn.parentNode.replaceChild(newBtn, currentBtn);
        newBtn.addEventListener('click', () => {
            const isSaved = toggleWatchlist(symbol);
            if (isSaved) newBtn.classList.add('active');
            else newBtn.classList.remove('active');
            initDashboard(); // refresh dashboard list in background
        });
        
        // Animate Score Counter
        let start = 0;
        const end = risk.risk_score;
        const duration = 1000;
        const increment = end / (duration / 16);
        const counter = setInterval(() => {
            start += increment;
            if (start >= end) {
                riskScore.textContent = end;
                clearInterval(counter);
            } else {
                riskScore.textContent = Math.floor(start);
            }
        }, 16);

        confidenceScore.textContent = risk.confidence;
        suggestionText.textContent = risk.explanation;
        
        reasonsList.innerHTML = '';
        
        // Remove any previously added PRO headers/badges (siblings of reasonsList)
        const parent = reasonsList.parentElement;
        parent.querySelectorAll('.pro-mode-header, [data-iris-dynamic]').forEach(el => el.remove());

        // PRO MODE header in Reasoning Engine
        if (risk.mode === 'PRO') {
            const proHeader = document.createElement('div');
            proHeader.className = 'pro-mode-header';
            proHeader.innerHTML = `⚡ Deep Scan Result &nbsp;|&nbsp; High Confidence Analysis`;
            reasonsList.before(proHeader);

            // Signal Strength badge
            const ss = risk.signal_strength || 'moderate';
            const ssBadge = document.createElement('div');
            ssBadge.setAttribute('data-iris-dynamic', 'true');
            ssBadge.style.marginBottom = '0.75rem';
            ssBadge.innerHTML = `
                <span style="font-size:0.8rem;color:var(--text-secondary);">Signal Strength: </span>
                <span class="signal-strength-badge signal-${ss}">${ss.toUpperCase()}</span>
            `;
            reasonsList.before(ssBadge);

            // Multi-timeframe note
            if (risk.multi_timeframe_note) {
                const mtf = document.createElement('div');
                mtf.setAttribute('data-iris-dynamic', 'true');
                mtf.style.cssText = 'font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.75rem;padding:0.5rem 0.75rem;background:rgba(139,92,246,0.08);border-left:2px solid #a78bfa;border-radius:4px;';
                mtf.textContent = '🔍 ' + risk.multi_timeframe_note;
                reasonsList.before(mtf);
            }
        }

        // Render detailed reasons
        if (risk.mode === 'PRO') {
            reasonsList.innerHTML = `<li style="display:flex;align-items:center;gap:0.5rem;color:var(--text-secondary);"><div class="spinner"></div> Generating advanced reasoning...</li>`;
        } else {
            if (risk.reasons && risk.reasons.length > 0) {
                risk.reasons.forEach(r => {
                    const li = document.createElement('li');
                    li.textContent = r;
                    reasonsList.appendChild(li);
                });
            }

            // Render detected patterns if any (as extra items)
            if (risk.pattern_detected && risk.pattern_detected.length > 0) {
                risk.pattern_detected.forEach(p => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>Pattern:</strong> ${p}`;
                    li.style.color = '#a78bfa'; // Purple for patterns
                    reasonsList.appendChild(li);
                });
            }

            if (reasonsList.children.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No explicit anomalous patterns detected.';
                li.style.color = 'var(--text-secondary)';
                reasonsList.appendChild(li);
            }
        }

        const levelClass = risk.risk_level.toLowerCase();
        riskCard.classList.add(`risk-${levelClass}-bg`);
        riskBadge.classList.add(`risk-${levelClass}-bg`);
        setTimeout(() => setProgress(risk.risk_score, risk.risk_level), 100);

        // 2. AI Sentiment Panel — show Narrative explanation
        sentimentBadge.textContent = sentiment.classification;
        sentimentBadge.className = `sentiment-badge risk-${sentiment.classification === 'POSITIVE' ? 'low' : (sentiment.classification === 'NEGATIVE' ? 'high' : 'medium')}-bg`;

        const isPro = risk.mode === 'PRO';

        // Build AI insight header
        const aiHeaderLabel = isPro ? '⚡ Deep Scan' : '📊 Market Analysis';
        const aiSourceHtml = `<span class="ai-source-badge" id="ai-source-badge" style="display:none;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> powered by IRIS AI</span>`;

        aiSummaryText.innerHTML = `
            <div class="ai-insight-header">
                <span class="ai-insight-label ${isPro ? 'ai-label-pro' : ''}">${aiHeaderLabel}</span>
                ${aiSourceHtml}
            </div>
            <p class="ai-insight-text" id="ai-typing-text" style="white-space: pre-wrap; line-height: 1.6;"></p>
        `;

        if (_typewriterTimer) { clearTimeout(_typewriterTimer); _typewriterTimer = null; }
        const typingEl = document.getElementById('ai-typing-text');
        const badgeEl = document.getElementById('ai-source-badge');

        if (data.ai_prompt_data && typingEl) {
            typingEl.innerHTML = '<div style="display:flex;align-items:center;gap:0.5rem;"><div class="spinner"></div><span style="color:var(--text-secondary);">Generating insights...</span></div>';
            
            fetch(`/api/generate_insight?pro=${isPro}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ market_data: data.ai_prompt_data })
            })
            .then(res => res.json())
            .then(resData => {
                const aiResponseText = resData.deep_scan || resData.explanation;
                if (aiResponseText) {
                    if (badgeEl) badgeEl.style.display = 'inline-flex';
                    typingEl.textContent = '';
                    let i = 0;
                    const chars = aiResponseText.split('');
                    const isPro = risk.mode === 'PRO';
                    // Faster speed for PRO mode: 4ms per char, 8ms for normal
                    const speed = isPro ? 3 : 6; 
                    
                    const type = () => {
                        if (i < chars.length) {
                            // In PRO mode, type 2 chars at a time to be even faster
                            const batch = isPro ? 3 : 1;
                            for(let b=0; b < batch && i < chars.length; b++) {
                                typingEl.textContent += chars[i++];
                            }
                            _typewriterTimer = setTimeout(type, speed);
                        } else {
                            _typewriterTimer = null; // done
                        }
                    };
                    type();
                } else {
                    typingEl.textContent = 'Failed to generate insight.';
                }
                
                if (resData.reasoning_engine && reasonsList) {
                    reasonsList.innerHTML = `<li style="white-space: pre-wrap; list-style-type: none; margin-left: -1rem; line-height: 1.6; color: #e2e8f0; font-size: 0.9rem;">${resData.reasoning_engine}</li>`;
                }
            })
            .catch(() => {
                typingEl.textContent = 'Error fetching AI insight.';
            });
        } else if (typingEl) {
            typingEl.textContent = 'Analyzing market conditions...';
        }

        // 3. News Feed
        newsFeed.innerHTML = '';
        if (sentiment.details && sentiment.details.length > 0) {
            sentiment.details.forEach(n => {
                const div = document.createElement('div');
                div.className = 'news-item';
                div.innerHTML = `<a href="#" onclick="return false;">${n.text}</a><div class="news-meta">Sentiment Score: ${n.score}</div>`;
                newsFeed.appendChild(div);
            });
        } else {
            newsFeed.innerHTML = '<p>No news available.</p>';
        }

        // 4. Interactive Chart
        renderChart(historical_data, currency, data.chart_intel);

        // 5. Market Phase Card
        if (data.market_phase) {
            renderMarketPhase(data.market_phase);
        }
        
        populateProFAQs(symbol);
    }

    // ── Market Phase Renderer ───────────────────────────────────────────────
    function renderMarketPhase(phase) {
        const card         = document.getElementById('market-phase-card');
        const iconEl       = document.getElementById('phase-icon');
        const nameEl       = document.getElementById('phase-name');
        const dirBadge     = document.getElementById('phase-direction-badge');
        const dirArrow     = document.getElementById('phase-direction-arrow');
        const dirText      = document.getElementById('phase-direction-text');
        const descEl       = document.getElementById('phase-description');
        const adxValEl     = document.getElementById('phase-adx-value');
        const adxStrEl     = document.getElementById('phase-adx-strength');
        const volEl        = document.getElementById('phase-vol-trend');
        const bbEl         = document.getElementById('phase-bb-width');
        const confBar      = document.getElementById('phase-conf-bar');
        const confText     = document.getElementById('phase-conf-text');

        if (!card || !phase) return;

        // Phase color map
        const phaseColors = {
            'TRENDING':     { glow: '255, 115, 0',   badge: '#ff7300', text: '#ff9940' },
            'RANGING':      { glow: '234, 179, 8',   badge: '#eab308', text: '#f0c040' },
            'ACCUMULATION': { glow: '59, 130, 246',  badge: '#3b82f6', text: '#60a5fa' },
            'DISTRIBUTION': { glow: '239, 68, 68',   badge: '#ef4444', text: '#f87171' },
        };

        const colors = phaseColors[phase.phase] || phaseColors['RANGING'];

        // Remove previous phase classes
        card.classList.remove(
            'phase-trending', 'phase-ranging', 'phase-accumulation', 'phase-distribution'
        );
        card.classList.add(`phase-${(phase.phase || 'ranging').toLowerCase()}`);

        // Style the glow border
        card.style.setProperty('--phase-glow-color', colors.glow);

        // Icon + Name
        iconEl.textContent = phase.phase_emoji || '🟡';
        nameEl.textContent = phase.phase_label || 'Ranging';
        nameEl.style.color = colors.text;

        // Direction badge
        const dir = phase.phase_direction || 'neutral';
        const arrowMap = { bullish: '↑', bearish: '↓', neutral: '→' };
        const dirColorMap = { bullish: '#2ea043', bearish: '#f85149', neutral: '#8b949e' };
        dirArrow.textContent = arrowMap[dir] || '→';
        dirText.textContent  = dir.charAt(0).toUpperCase() + dir.slice(1);
        dirBadge.style.borderColor  = dirColorMap[dir] || '#8b949e';
        dirBadge.style.color        = dirColorMap[dir] || '#8b949e';
        dirBadge.style.background   = `${dirColorMap[dir] || '#8b949e'}18`;

        // Description
        descEl.textContent = phase.description || 'Market phase analysis complete.';

        // ADX
        adxValEl.textContent = phase.adx != null ? phase.adx.toFixed(1) : '—';
        adxStrEl.textContent = (phase.adx_strength || 'weak').toUpperCase();
        adxStrEl.style.color = phase.adx >= 35 ? '#f87171' : (phase.adx >= 25 ? '#fb923c' : '#8b949e');

        // Volume trend
        const volMap = { expanding: '▲ Expanding', contracting: '▼ Contracting', neutral: '→ Neutral' };
        const volColorMap = { expanding: '#2ea043', contracting: '#f85149', neutral: '#8b949e' };
        const vt = phase.volume_trend || 'neutral';
        volEl.textContent = volMap[vt] || '→ Neutral';
        volEl.style.color = volColorMap[vt] || '#8b949e';

        // BB Width
        bbEl.textContent = phase.bb_width != null ? `${phase.bb_width.toFixed(2)}%` : '—';

        // Confidence bar — animate from 0 to value
        const conf = phase.confidence || 0;
        confText.textContent = `${conf}% confidence`;
        confBar.style.width = '0%';
        confBar.style.background = `rgb(${colors.glow})`;
        setTimeout(() => {
            confBar.style.transition = 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
            confBar.style.width = `${conf}%`;
        }, 120);
    }

    function populateProFAQs(symbol) {
        const faqList = document.getElementById('faq-list');
        if (!faqList) return;

        const faqs = [
            {
                q: `What are the systemic risks for ${symbol}?`,
                a: `Systemic risks involve broad market shifts that directly impact ${symbol}'s liquidity and volatility profile. A sudden spike in the VIX or macroeconomic rate shifts could trigger algorithmic sell-offs regardless of ${symbol}'s underlying fundamentals.`
            },
            {
                q: `What could trigger a sudden drawdown?`,
                a: `Based on historical patterns, ${symbol} is sensitive to sudden drops in trading volume followed by large block trades. An unanticipated earnings miss or a sector-wide downgrade often acts as a catalyst for breaking critical support levels.`
            },
            {
                q: `How does macro policy affect ${symbol}?`,
                a: `Interest rate decisions and inflation data heavily influence ${symbol}'s capital flows. Higher rates typically discount future cash flows, putting downward pressure on its valuation, while quantitative easing tends to provide a liquidity floor.`
            }
        ];

        faqList.innerHTML = '';
        faqs.forEach((faq, index) => {
            const item = document.createElement('div');
            item.className = 'faq-item';
            
            const question = document.createElement('div');
            question.className = 'faq-question';
            question.innerHTML = `
                <span>${faq.q}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            `;
            
            const answer = document.createElement('div');
            answer.className = 'faq-answer';
            answer.innerHTML = `<p>${faq.a}</p>`;
            
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                // Close all
                document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
                // Toggle current
                if (!isActive) item.classList.add('active');
            });

            item.appendChild(question);
            item.appendChild(answer);
            faqList.appendChild(item);
        });
    }
    
    // ── Timeframe Confirmation & Cinematic Switch ──────────────────────────────
    const tfModal        = document.getElementById('tf-confirm-modal');
    const tfConfirmLabel = document.getElementById('tf-confirm-label');
    const tfCancelBtn    = document.getElementById('tf-cancel-btn');
    const tfConfirmBtn   = document.getElementById('tf-confirm-btn');
    const tfOverlay      = document.getElementById('tf-switch-overlay');
    const tfOverlayLbl   = document.getElementById('tf-overlay-interval');
    const tfOverlaySub   = document.getElementById('tf-overlay-sub');
    // NOTE: tfOverlayBar is NOT cached — we query it live each time because we replace the node

    const TF_LABELS = { '5m': '5 MIN', '15m': '15 MIN', '1h': '1 HOUR', '1d': '1 DAY', '1wk': '1 WEEK' };
    const TF_SUBS   = {
        '5m':  'Fetching intraday 5-minute data...', '15m': 'Fetching intraday 15-minute data...',
        '1h':  'Fetching hourly data...', '1d': 'Recalibrating daily risk engine...',
        '1wk': 'Performing long-horizon weekly scan...'
    };

    let pendingInterval   = null;  // interval selected but not confirmed
    let pendingToggleBtn  = null;

    function showTfModal(interval, btn) {
        pendingInterval  = interval;
        pendingToggleBtn = btn;
        tfConfirmLabel.textContent = TF_LABELS[interval] || interval.toUpperCase();
        tfModal.classList.remove('hidden', 'fade-out');
    }

    tfCancelBtn.addEventListener('click', () => {
        tfModal.classList.add('fade-out');
        setTimeout(() => tfModal.classList.add('hidden'), 200);
        pendingInterval = null; pendingToggleBtn = null;
    });

    // Close on backdrop click
    tfModal.addEventListener('click', (e) => {
        if (e.target === tfModal) tfCancelBtn.click();
    });

    tfConfirmBtn.addEventListener('click', () => {
        // 1. Close modal immediately
        tfModal.classList.add('fade-out');
        setTimeout(() => tfModal.classList.add('hidden'), 200);

        const interval = pendingInterval;
        const btn      = pendingToggleBtn;
        pendingInterval = null; pendingToggleBtn = null;

        // 2. Update active button state
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentInterval = interval;

        // 3. Read current symbol
        const symbol = document.querySelector('.search-input').value.trim().toUpperCase();
        if (!symbol) return;

        // 4. START FETCH immediately in the background
        const url = `/api/analyze/${symbol}?interval=${interval}${isProMode ? '&pro=true' : ''}`;
        const fetchPromise = fetch(url).then(r => r.json());

        // 5. Show cinematic overlay
        tfOverlayLbl.textContent = TF_LABELS[interval] || interval.toUpperCase();
        tfOverlaySub.textContent = TF_SUBS[interval] || 'Recalibrating risk engine...';
        // Query the bar LIVE from the DOM each time (it gets replaced each run)
        const currentBar = document.getElementById('tf-overlay-bar-fill');
        const freshBar = currentBar.cloneNode(true);
        freshBar.id = 'tf-overlay-bar-fill'; // keep the id for future runs
        freshBar.style.width = '0%';
        freshBar.style.transition = 'none';
        currentBar.parentNode.replaceChild(freshBar, currentBar);
        // Animate bar over 1.8s
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                freshBar.style.transition = 'width 1.8s ease-out';
                freshBar.style.width = '100%';
            });
        });
        tfOverlay.classList.remove('hidden', 'fade-out');

        // Minimum display time 1.8s, then wait for data — whichever is LAST wins
        const animPromise = new Promise(res => setTimeout(res, 1800));

        Promise.all([fetchPromise, animPromise]).then(([data]) => {
            // Fade out overlay
            tfOverlay.classList.add('fade-out');
            setTimeout(() => tfOverlay.classList.add('hidden'), 400);

            // Render new data
            if (data && !data.error) {
                const vd = document.getElementById('view-detail');
                if (data.risk && data.risk.mode === 'PRO') vd.classList.add('pro-mode-active');
                else vd.classList.remove('pro-mode-active');
                displayDetailView(data);
                // No need for separate resize if renderChart handles it
            } else {
                showError(data && data.reasons ? data.reasons[0] : 'Failed to load new timeframe data.');
            }
        }).catch(() => {
            tfOverlay.classList.add('fade-out');
            setTimeout(() => tfOverlay.classList.add('hidden'), 400);
            showError('Network error while switching timeframe.');
        });
    });

    function initTimeframeToggles() {
        const toggleBtns = document.querySelectorAll('.chart-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const interval = e.target.getAttribute('data-interval');
                const symbol   = document.querySelector('.search-input').value.trim();
                // Only show modal if we're in the detail view with a loaded symbol
                if (!symbol || document.getElementById('view-detail').classList.contains('hidden')) {
                    // Just update interval silently if no analysis is loaded
                    document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    currentInterval = interval;
                    return;
                }
                showTfModal(interval, e.target);
            });
        });
    }

    let allMarkers = [];
    let activeMarkerTypes = { volume: true, price: true, pattern: true };

    function initChartControls() {
        const toggles = {
            'toggle-volume': 'volume',
            'toggle-price': 'price',
            'toggle-pattern': 'pattern'
        };

        Object.entries(toggles).forEach(([id, type]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => {
                    activeMarkerTypes[type] = !activeMarkerTypes[type];
                    el.classList.toggle('active', activeMarkerTypes[type]);
                    applyMarkers();
                });
            }
        });
    }

    function applyMarkers() {
        if (!candlestickSeries) return;
        const filtered = allMarkers.filter(m => activeMarkerTypes[m.type]);
        candlestickSeries.setMarkers(filtered);
    }

    function initDrawingTools() {
        const tools = document.querySelectorAll('.draw-tool');
        tools.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.getAttribute('data-tool');
                
                // Special case: Eraser button as a "Delete Selected" action
                if (tool === 'eraser' && selectedDrawing) {
                    deleteSelectedDrawing();
                    // If we just deleted something, we don't necessarily want to switch tools
                    // but the user wants to go back to cursor.
                    setTimeout(() => {
                        const ptr = document.querySelector('[data-tool="pointer"]');
                        if (ptr) ptr.click();
                    }, 50);
                    return;
                }

                tools.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTool = tool;
                drawingPoints = [];
                
                // Clear selection when switching tools
                deselectDrawing();
                
                if (tempSeries && tvChart) {
                    tvChart.removeSeries(tempSeries);
                    tempSeries = null;
                }

                updateChartLock();
            });
        });

        document.getElementById('btn-undo-drawing').addEventListener('click', () => {
            undoLastDrawing();
            updateChartLock();
        });
        document.getElementById('btn-clear-drawings').addEventListener('click', () => {
            clearAllDrawings();
            updateChartLock();
        });

        document.addEventListener('keydown', (e) => {
            const target = e.target.tagName.toLowerCase();
            if (target === 'input' || target === 'textarea') return;

            if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
                const btn = document.querySelector('[data-tool="pointer"]');
                if (btn) btn.click();
            } else if (e.key.toLowerCase() === 't') {
                const btn = document.querySelector('[data-tool="trendline"]');
                if (btn) btn.click();
            } else if (e.key.toLowerCase() === 'h') {
                const btn = document.querySelector('[data-tool="horizline"]');
                if (btn) btn.click();
            } else if (e.key.toLowerCase() === 'e') {
                const btn = document.querySelector('[data-tool="eraser"]');
                if (btn) btn.click();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoLastDrawing();
                updateChartLock();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedDrawing) {
                    deleteSelectedDrawing();
                    updateChartLock();
                }
            }
        });
    }

    function clearAllDrawings() {
        if (!tvChart) return;
        drawings.forEach(d => {
            try {
                if (d.type === 'trendline') tvChart.removeSeries(d.series);
                if (d.type === 'horizline') candlestickSeries.removePriceLine(d.line);
            } catch (e) {}
        });
        drawings = [];
        selectedDrawing = null;
        
        // Also clear any in-progress drawing (ghost line)
        if (tempSeries) {
            try { tvChart.removeSeries(tempSeries); } catch(e) {}
            tempSeries = null;
        }
        drawingPoints = [];

        // Return to cursor
        const ptr = document.querySelector('[data-tool="pointer"]');
        if (ptr) ptr.click();
    }

    function deleteSelectedDrawing() {
        if (!selectedDrawing) return;
        const d = selectedDrawing;
        try {
            if (d.type === 'trendline') tvChart.removeSeries(d.series);
            if (d.type === 'horizline') candlestickSeries.removePriceLine(d.line);
        } catch (e) {}
        drawings = drawings.filter(item => item !== d);
        selectedDrawing = null;
    }

    function deselectDrawing() {
        if (selectedDrawing) {
            if (selectedDrawing.type === 'trendline') {
                selectedDrawing.series.applyOptions({ color: '#3b82f6' });
            } else {
                selectedDrawing.line.applyOptions({ color: '#8b949e' });
            }
            selectedDrawing = null;
        }
    }

    function undoLastDrawing() {
        if (drawings.length === 0) return;
        const last = drawings.pop();
        try {
            if (last.type === 'trendline') tvChart.removeSeries(last.series);
            if (last.type === 'horizline') candlestickSeries.removePriceLine(last.line);
        } catch (e) {}
        if (selectedDrawing === last) selectedDrawing = null;
    }

    function initFullscreen() {
        const btn = document.getElementById('btn-chart-fullscreen');
        const container = document.getElementById('chart-section-container');
        
        btn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });

        document.addEventListener('fullscreenchange', () => {
            if (tvChart) {
                setTimeout(() => {
                    const h = document.fullscreenElement ? container.clientHeight - 100 : chartContainer.clientHeight;
                    tvChart.resize(chartContainer.clientWidth, h);
                }, 100);
            }
        });
    }

    function renderChart(data, currency, intel) {
        if (!data || data.length === 0) return;

        if (tvChart) {
            tvChart.remove();
        }
        
        drawings = []; // Clear stale drawing references
        selectedDrawing = null;

        chartContainer.innerHTML = '<div id="chart-tooltip" class="chart-tooltip"></div>';
        const tooltip = document.getElementById('chart-tooltip');
        
        const currencySymbol = currency === 'INR' ? '₹' : '$';

        const chartOptions = {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight || 450,
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#8b949e',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                horzLine: { visible: true, labelVisible: true },
                vertLine: { visible: true, labelVisible: true },
            },
            localization: {
                priceFormatter: price => currencySymbol + price.toFixed(2)
            }
        };

        tvChart = LightweightCharts.createChart(chartContainer, chartOptions);

        candlestickSeries = tvChart.addCandlestickSeries({
            upColor: '#2ea043',
            downColor: '#f85149',
            borderVisible: false,
            wickUpColor: '#2ea043',
            wickDownColor: '#f85149'
        });

        const candleData = data.filter(d => d.open !== null).map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));
        
        candlestickSeries.setData(candleData);

        // Handle Markers (Anomalies)
        if (intel && intel.markers) {
            allMarkers = intel.markers;
            applyMarkers();
        }

        // Handle Breakout Zones (Shaded Areas)
        if (intel && intel.zones) {
            intel.zones.forEach(zone => {
                const areaSeries = tvChart.addAreaSeries({
                    topColor: zone.type === 'bullish' ? 'rgba(46, 160, 67, 0.2)' : 'rgba(248, 81, 73, 0.2)',
                    bottomColor: 'rgba(0, 0, 0, 0)',
                    lineColor: zone.type === 'bullish' ? 'rgba(46, 160, 67, 0.4)' : 'rgba(248, 81, 73, 0.4)',
                    lineWidth: 1,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    crosshairMarkerVisible: false,
                });
                
                // Create a box by setting data points at start and end for both high and low
                // Since AreaSeries only supports one value, we use multiple series or just markers
                // For simplicity, let's use a single line at the breakout level
                const line = candlestickSeries.createPriceLine({
                    price: zone.type === 'bullish' ? zone.high : zone.low,
                    color: zone.type === 'bullish' ? '#2ea043' : '#f85149',
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    axisLabelVisible: true,
                    title: 'Breakout Level',
                });
            });
        }

        // Custom Tooltip Logic
        tvChart.subscribeCrosshairMove(param => {
            if (!param.time || param.point === undefined || !intel || !intel.markers) {
                tooltip.style.display = 'none';
                return;
            }

            const activeMarkers = allMarkers.filter(m => activeMarkerTypes[m.type]);
            const marker = activeMarkers.find(m => m.time === param.time);

            if (marker) {
                const dateStr = new Date(marker.time * 1000).toLocaleString();
                tooltip.style.display = 'block';
                tooltip.innerHTML = `
                    <div class="chart-tooltip-header chart-tooltip-type-${marker.type}">
                        <span>${marker.text === 'V' ? '📊' : (marker.text === 'P' ? '📈' : '✨')}</span>
                        ${marker.type.toUpperCase()} ANOMALY
                    </div>
                    <div class="chart-tooltip-body">
                        ${marker.description}<br/>
                        <span style="font-size:0.75rem;opacity:0.6;">${dateStr}</span>
                    </div>
                `;

                // Dynamic Positioning
                const containerWidth = chartContainer.clientWidth;
                const containerHeight = chartContainer.clientHeight;
                const tooltipWidth = 220;
                const tooltipHeight = 100; // Approximate height for boundary check
                
                let left = param.point.x + 15;
                let top = param.point.y + 15;
                
                // Horizontal boundary check (Right)
                if (left + tooltipWidth > containerWidth) {
                    left = param.point.x - tooltipWidth - 15;
                }
                // Horizontal boundary check (Left)
                if (left < 0) left = 10;

                // Vertical boundary check (Bottom)
                if (top + tooltipHeight > containerHeight) {
                    top = param.point.y - tooltipHeight - 15;
                }
                // Vertical boundary check (Top)
                if (top < 0) top = 10;

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            } else {
                tooltip.style.display = 'none';
            }

            // --- Snapping & Ghost Line ---
            if (activeTool !== 'pointer' && activeTool !== 'eraser' && param.time && param.point) {
                const price = candlestickSeries.coordinateToPrice(param.point.y);
                const candleAtTime = candleData.find(c => c.time === param.time);
                let snappedPrice = price;

                if (candleAtTime) {
                    const ohlc = [candleAtTime.open, candleAtTime.high, candleAtTime.low, candleAtTime.close];
                    let minDiff = Infinity;
                    ohlc.forEach(v => {
                        const diff = Math.abs(v - price);
                        if (diff < minDiff) { minDiff = diff; snappedPrice = v; }
                    });
                    // Threshold check: only snap if within ~20 pixels
                    const yCoord = candlestickSeries.priceToCoordinate(price);
                    const snapYCoord = candlestickSeries.priceToCoordinate(snappedPrice);
                    if (Math.abs(yCoord - snapYCoord) > 25) snappedPrice = price;
                }

                if (activeTool === 'trendline' && drawingPoints.length === 1) {
                    if (!tempSeries) {
                        tempSeries = tvChart.addLineSeries({
                            color: 'rgba(59, 130, 246, 0.6)',
                            lineWidth: 1,
                            lineStyle: 2,
                            lastValueVisible: false,
                            priceLineVisible: false,
                            crosshairMarkerVisible: false,
                        });
                    }
                    tempSeries.setData([
                        { time: drawingPoints[0].time, value: drawingPoints[0].price },
                        { time: param.time, value: snappedPrice }
                    ]);
                }
            }
        });

        // Click to Draw / Delete
        tvChart.subscribeClick(param => {
            if (!param.point || !param.time) return;

            const price = candlestickSeries.coordinateToPrice(param.point.y);
            
            // Snap for placement
            let finalPrice = price;
            const candleAtTime = candleData.find(c => c.time === param.time);
            if (candleAtTime && activeTool !== 'eraser' && activeTool !== 'pointer') {
                const ohlc = [candleAtTime.open, candleAtTime.high, candleAtTime.low, candleAtTime.close];
                let minDiff = Infinity;
                ohlc.forEach(v => {
                    const diff = Math.abs(v - price);
                    if (diff < minDiff) { minDiff = diff; finalPrice = v; }
                });
                const yCoord = candlestickSeries.priceToCoordinate(price);
                const snapYCoord = candlestickSeries.priceToCoordinate(finalPrice);
                if (Math.abs(yCoord - snapYCoord) > 25) finalPrice = price;
            }

            if (activeTool === 'eraser') {
                const dIndex = drawings.findIndex(d => {
                    if (d.type === 'horizline') return Math.abs(d.price - price) < (price * 0.015);
                    if (d.type === 'trendline') {
                        // Check proximity to trendline points
                        const data = d.data;
                        const t1 = data[0].time; const p1 = data[0].value;
                        const t2 = data[1].time; const p2 = data[1].value;
                        // Use price/time tolerance for simplified hit testing
                        const timeInPath = (param.time >= Math.min(t1, t2)) && (param.time <= Math.max(t1, t2));
                        if (!timeInPath) return false;
                        // linear interpolation to check price at that time
                        const ratio = (param.time - t1) / (t2 - t1 || 1);
                        const expectedPrice = p1 + ratio * (p2 - p1);
                        return Math.abs(expectedPrice - price) < (price * 0.015);
                    }
                    return false;
                });
                if (dIndex !== -1) {
                    const d = drawings[dIndex];
                    try {
                        if (d.type === 'trendline') tvChart.removeSeries(d.series);
                        if (d.type === 'horizline') candlestickSeries.removePriceLine(d.line);
                    } catch (e) {}
                    drawings.splice(dIndex, 1);
                    if (selectedDrawing === d) selectedDrawing = null;
                }
                return;
            }

            if (activeTool === 'pointer') {
                // Select drawing
                const d = drawings.find(d => {
                    if (d.type === 'horizline') return Math.abs(d.price - price) < (price * 0.015);
                    if (d.type === 'trendline') {
                        const data = d.data;
                        const t1 = data[0].time; const p1 = data[0].value;
                        const t2 = data[1].time; const p2 = data[1].value;
                        if (param.time < Math.min(t1, t2) || param.time > Math.max(t1, t2)) return false;
                        const ratio = (param.time - t1) / (t2 - t1 || 1);
                        const expectedPrice = p1 + ratio * (p2 - p1);
                        return Math.abs(expectedPrice - price) < (price * 0.015);
                    }
                    return false;
                });

                deselectDrawing();
                if (d) {
                    selectedDrawing = d;
                    if (d.type === 'trendline') d.series.applyOptions({ color: '#a78bfa' });
                    else d.line.applyOptions({ color: '#a78bfa' });
                }
                updateChartLock();
                return;
            }

            if (activeTool === 'horizline') {
                const line = candlestickSeries.createPriceLine({
                    price: finalPrice,
                    color: '#8b949e',
                    lineWidth: 2,
                    lineStyle: 0,
                    axisLabelVisible: true,
                    title: '',
                });
                drawings.push({ type: 'horizline', line: line, price: finalPrice });
                
                // Auto-deselect with small delay for stability
                setTimeout(() => {
                    const pointerBtn = document.querySelector('[data-tool="pointer"]');
                    if (pointerBtn) pointerBtn.click();
                }, 50);
            } else if (activeTool === 'trendline') {
                if (drawingPoints.length === 0) {
                    drawingPoints.push({ time: param.time, price: finalPrice });
                } else {
                    const lineSeries = tvChart.addLineSeries({
                        color: '#3b82f6',
                        lineWidth: 2,
                        lastValueVisible: false,
                        priceLineVisible: false,
                    });
                    const trendData = [
                        { time: drawingPoints[0].time, value: drawingPoints[0].price },
                        { time: param.time, value: finalPrice }
                    ];
                    lineSeries.setData(trendData);
                    drawings.push({ type: 'trendline', series: lineSeries, data: trendData });
                    drawingPoints = [];
                    if (tempSeries) {
                        tvChart.removeSeries(tempSeries);
                        tempSeries = null;
                    }

                    // Auto-deselect with small delay for stability
                    setTimeout(() => {
                        const pointerBtn = document.querySelector('[data-tool="pointer"]');
                        if (pointerBtn) pointerBtn.click();
                    }, 50);
                }
            }
        });

        // --- Drag & Drop Logic ---
        const chartEl = chartContainer.querySelector('canvas'); 
        if (chartEl) {
            chartContainer.addEventListener('mousedown', (e) => {
                if (activeTool === 'pointer' && selectedDrawing) {
                    isDragging = true;
                    // We don't need dragStart yet, we calculate delta on the fly
                }
            });

            chartContainer.addEventListener('mousemove', (e) => {
                if (isDragging && selectedDrawing && tvChart) {
                    // Logic to update drawing based on mouse delta
                    // Convert movement to price delta
                    const rect = chartContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    const time = tvChart.timeScale().coordinateToTime(x);
                    const price = candlestickSeries.coordinateToPrice(y);
                    
                    if (!time || !price) return;

                    if (selectedDrawing.type === 'horizline') {
                        selectedDrawing.price = price;
                        selectedDrawing.line.applyOptions({ price: price });
                    } else if (selectedDrawing.type === 'trendline') {
                        const data = selectedDrawing.data;
                        // For moving trendline, shift both points by delta
                        // Calculate time delta in indices if possible, or just seconds
                        const timeDelta = (time - data[1].time);
                        const priceDelta = (price - data[1].value);
                        
                        if (!isNaN(timeDelta) && !isNaN(priceDelta)) {
                            data[0].time += timeDelta;
                            data[0].value += priceDelta;
                            data[1].time = time;
                            data[1].value = price;
                            
                            selectedDrawing.series.setData(data);
                        }
                    }
                }
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });
        }

        tvChart.timeScale().fitContent();
    }

    initChartControls();
    
    window.addEventListener('resize', () => {
        if (tvChart && !viewDetail.classList.contains('hidden')) {
            tvChart.resize(chartContainer.clientWidth, chartContainer.clientHeight || 450);
        }
    });

    // --- Watchlist Logic ---
    function getWatchlist() {
        return JSON.parse(localStorage.getItem('iris_watchlist') || '[]');
    }

    function toggleWatchlist(symbol) {
        let list = getWatchlist();
        if (list.includes(symbol)) {
            list = list.filter(s => s !== symbol);
        } else {
            list.push(symbol);
        }
        localStorage.setItem('iris_watchlist', JSON.stringify(list));
        return list.includes(symbol);
    }
});
