/* ==========================================================================
   RISE 2026 — PARTICIPANT ACCESS TERMINAL
   Full Application Logic: Loading → Scanner → Identity Card
   ========================================================================== */

(function () {
    'use strict';

    // ── DOM ELEMENTS ──────────────────────────────────────────────────────
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingPct = document.getElementById('loading-pct');
    const loadingStepMsg = document.getElementById('loading-step-msg');

    const hudClock = document.getElementById('hud-clock');
    const scannerPad = document.getElementById('scanner-pad');
    const scanPrompt = document.getElementById('scan-prompt');
    const scanSubPrompt = document.getElementById('scan-sub-prompt');
    const percentDisplay = document.getElementById('percentage-display');
    const statusMessage = document.getElementById('status-message');
    const progressBar = document.getElementById('scanner-progress-bar');
    const terminalLogs = document.getElementById('terminal-logs');

    const identityOverlay = document.getElementById('identity-overlay');
    const portraitCanvas = document.getElementById('portrait-canvas');
    const btnRescan = document.getElementById('btn-rescan');

    // Identity card value elements
    const valName = document.getElementById('val-name');
    const valFaction = document.getElementById('val-faction');
    const valClass = document.getElementById('val-class');
    const cardIdTag = document.getElementById('card-id-tag');
    const valHeartrate = document.getElementById('val-heartrate');
    const valMutation = document.getElementById('val-mutation');
    const valThreat = document.getElementById('val-threat');
    const statSynaptic = document.getElementById('stat-synaptic');
    const statCyber = document.getElementById('stat-cyber');
    const statCompliance = document.getElementById('stat-compliance');

    const bgCanvas = document.getElementById('bg-canvas');
    const bgCtx = bgCanvas.getContext('2d');

    // ── CONSTANTS ─────────────────────────────────────────────────────────
    const CIRCUMFERENCE = 2 * Math.PI * 165; // Progress ring circumference
    const SCAN_DURATION = 3500;              // ms to complete scan

    // ── STATE ─────────────────────────────────────────────────────────────
    let isScanning = false;
    let scanStartTime = 0;
    let scanProgress = 0;
    let scanAnimFrame = null;
    let appReady = false;

    // ── AUDIO CONTEXT (Web Audio API for synthesized sounds) ──────────────
    let audioCtx = null;
    function ensureAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type, vol) {
        try {
            const ctx = ensureAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (_) { /* Audio not supported – silent fallback */ }
    }

    function playScanBeep() { playTone(880, 0.08, 'square', 0.04); }
    function playSuccessChime() {
        playTone(523, 0.15, 'sine', 0.06);
        setTimeout(() => playTone(659, 0.15, 'sine', 0.06), 120);
        setTimeout(() => playTone(784, 0.25, 'sine', 0.08), 240);
    }
    function playErrorBuzz() { playTone(120, 0.3, 'sawtooth', 0.06); }

    function playPurgeSound() {
        // A "smart" high-tech processing sound: clean, crisp ascending tones
        playTone(880, 0.05, 'sine', 0.05);
        setTimeout(() => playTone(1108, 0.05, 'sine', 0.04), 80);
        setTimeout(() => playTone(1318, 0.05, 'sine', 0.03), 160);
        setTimeout(() => playTone(1760, 0.15, 'sine', 0.03), 240);

        // Underneath, a subtle digital 'scan' sweep
        try {
            const ctx = ensureAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.1);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (_) { }
    }
    // ══════════════════════════════════════════════════════════════════════
    //  1. LOADING SCREEN
    // ══════════════════════════════════════════════════════════════════════

    const LOADING_STEPS = [
        'INITIALIZING SECURE TERMINAL...',
        'CONNECTING TO RISE 2026 NODE...',
        'LOADING CLUSTER DATABASES...',
        'AUTHENTICATING ICC UTHM LINK...',
        'CALIBRATING BIOMETRIC SENSORS...',
        'DECRYPTING EVENT PROTOCOLS...',
        'LOADING PARTICIPANT REGISTRY...',
        'SYNCING DATE: 10–11 JUNE 2026...',
        'ESTABLISHING OMEGA CLEARANCE...',
        'TERMINAL READY. WELCOME.'
    ];

    function runLoadingScreen() {
        loadingScreen.classList.add('active');

        let progress = 0;
        const totalDuration = 3800; // ms
        const stepInterval = totalDuration / LOADING_STEPS.length;
        let stepIndex = 0;
        const startTime = performance.now();

        function updateLoading(now) {
            const elapsed = now - startTime;
            // Non-linear progress: accelerates then slows
            const rawPct = Math.min(elapsed / totalDuration, 1);
            progress = Math.round(easeOutCubic(rawPct) * 100);

            loadingBarFill.style.width = progress + '%';
            loadingPct.textContent = progress + '%';

            // Step messages
            const newStepIdx = Math.min(Math.floor(elapsed / stepInterval), LOADING_STEPS.length - 1);
            if (newStepIdx !== stepIndex) {
                stepIndex = newStepIdx;
                loadingStepMsg.textContent = LOADING_STEPS[stepIndex];
            }

            if (rawPct < 1) {
                requestAnimationFrame(updateLoading);
            } else {
                // Loading complete
                loadingStepMsg.textContent = 'TERMINAL READY. WELCOME.';
                loadingBarFill.style.width = '100%';
                loadingPct.textContent = '100%';

                setTimeout(() => {
                    loadingScreen.classList.add('fade-out');
                    setTimeout(() => {
                        loadingScreen.classList.remove('active', 'fade-out');
                        appReady = true;
                        addLog('[SYS] Terminal boot complete.', 'text-green');
                        addLog('[SYS] Palm scanner ACTIVATED.', 'text-cyan');
                    }, 500);
                }, 600);
            }
        }

        requestAnimationFrame(updateLoading);
    }

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    const RESET_STEPS = [
        'PURGING SESSION DATA...',
        'WIPING LOCAL CACHE...',
        'RECALIBRATING BIOMETRIC SENSORS...',
        'ESTABLISHING SECURE HANDSHAKE...',
        'TERMINAL READY. STANDBY FOR NEXT PARTICIPANT.'
    ];

    function runResetLoadingScreen(onComplete) {
        const purgeScreen = document.getElementById('purge-screen');
        const purgeStatus = document.getElementById('purge-status');

        purgeScreen.classList.remove('fade-out');
        purgeScreen.classList.add('active');

        let stepIndex = 0;
        const totalDuration = 1800;
        const stepInterval = totalDuration / RESET_STEPS.length;
        const startTime = performance.now();

        function updatePurge(now) {
            const elapsed = now - startTime;
            const rawPct = Math.min(elapsed / totalDuration, 1);

            const newStepIdx = Math.min(Math.floor(elapsed / stepInterval), RESET_STEPS.length - 1);
            if (newStepIdx !== stepIndex) {
                stepIndex = newStepIdx;
                purgeStatus.textContent = RESET_STEPS[stepIndex];
            }

            if (rawPct < 1) {
                requestAnimationFrame(updatePurge);
            } else {
                purgeStatus.textContent = 'TERMINAL RESET. STANDBY.';
                setTimeout(() => {
                    purgeScreen.classList.add('fade-out');
                    setTimeout(() => {
                        purgeScreen.classList.remove('active', 'fade-out');
                        if (onComplete) onComplete();
                    }, 400);
                }, 300);
            }
        }

        requestAnimationFrame(updatePurge);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  2. HUD CLOCK
    // ══════════════════════════════════════════════════════════════════════

    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        hudClock.textContent = `${h}:${m}:${s} // ${dd}.${mm}.${yyyy}`;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  3. TERMINAL LOG STREAM
    // ══════════════════════════════════════════════════════════════════════

    function addLog(text, colorClass) {
        const line = document.createElement('div');
        line.className = 'log-line' + (colorClass ? ' ' + colorClass : '');
        line.textContent = text;
        terminalLogs.appendChild(line);
        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }

    // Ambient log messages that stream periodically
    const AMBIENT_LOGS = [
        { text: '[NET] Heartbeat OK — latency 12ms', cls: '' },
        { text: '[SEC] No intrusion detected.', cls: 'text-cyan' },
        { text: '[EVT] Registration window: OPEN', cls: 'text-green' },
        { text: '[SYS] Cluster 5 sync: 99.8%', cls: '' },
        { text: '[NET] Node RISE26_CORE responding.', cls: 'text-cyan' },
        { text: '[SEC] Firewall status: NOMINAL', cls: '' },
        { text: '[EVT] Dewan Sultan Ibrahim: READY', cls: 'text-green' },
        { text: '[SYS] Memory usage: 42.6%', cls: '' },
        { text: '[NET] Encrypted tunnel active.', cls: 'text-cyan' },
        { text: '[SEC] Participant DB integrity: OK', cls: '' },
    ];

    let ambientLogIdx = 0;
    function streamAmbientLog() {
        if (!isScanning) {
            const entry = AMBIENT_LOGS[ambientLogIdx % AMBIENT_LOGS.length];
            addLog(entry.text, entry.cls);
            ambientLogIdx++;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  4. BACKGROUND CANVAS — PARTICLE GRID
    // ══════════════════════════════════════════════════════════════════════

    let particles = [];
    const PARTICLE_COUNT = 55;

    function resizeCanvas() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * bgCanvas.width,
                y: Math.random() * bgCanvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 1.5 + 0.5,
            });
        }
    }

    function drawParticles() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

        // Connection lines
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 160) {
                    const opacity = (1 - dist / 160) * 0.15;
                    bgCtx.strokeStyle = `rgba(155, 0, 48, ${opacity})`;
                    bgCtx.lineWidth = 0.5;
                    bgCtx.beginPath();
                    bgCtx.moveTo(particles[i].x, particles[i].y);
                    bgCtx.lineTo(particles[j].x, particles[j].y);
                    bgCtx.stroke();
                }
            }
        }

        // Particle dots
        for (const p of particles) {
            bgCtx.fillStyle = 'rgba(200, 0, 62, 0.5)';
            bgCtx.beginPath();
            bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            bgCtx.fill();

            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > bgCanvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > bgCanvas.height) p.vy *= -1;
        }

        requestAnimationFrame(drawParticles);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  5. SCANNER INTERACTION (Click/Touch → hold → scan → result)
    // ══════════════════════════════════════════════════════════════════════

    function startScan() {
        if (!appReady) return;
        if (isScanning) return;
        isScanning = true;
        scanStartTime = performance.now();
        scanProgress = 0;

        scannerPad.classList.add('scanning');
        scanPrompt.textContent = 'SCANNING...';
        scanSubPrompt.textContent = 'KEEP PALM STEADY';
        statusMessage.textContent = 'RISE 2026 TERMINAL: SCANNING';

        addLog('[SCAN] Palm contact detected.', 'text-cyan');
        addLog('[SCAN] Biometric capture in progress...', '');

        playScanBeep();

        animateScan();
    }

    function animateScan() {
        if (!isScanning) return;

        const elapsed = performance.now() - scanStartTime;
        scanProgress = Math.min(elapsed / SCAN_DURATION, 1);

        const pct = Math.round(scanProgress * 100);
        percentDisplay.textContent = pct + '%';

        // Update progress ring
        const offset = CIRCUMFERENCE - (scanProgress * CIRCUMFERENCE);
        progressBar.style.strokeDashoffset = offset;

        // Beep at milestones
        if (pct === 25 || pct === 50 || pct === 75) {
            playScanBeep();
        }

        // Phase 2: Analyzing (last 25%)
        if (scanProgress > 0.75) {
            scannerPad.classList.add('analyzing');
            scanPrompt.textContent = 'ANALYZING...';
            statusMessage.textContent = 'DECRYPTING PARTICIPANT DATA';
        }

        if (scanProgress < 1) {
            scanAnimFrame = requestAnimationFrame(animateScan);
        } else {
            completeScan();
        }
    }

    function cancelScan() {
        if (!isScanning) return;
        isScanning = false;

        if (scanAnimFrame) cancelAnimationFrame(scanAnimFrame);

        scannerPad.classList.remove('scanning', 'analyzing');
        scanPrompt.textContent = 'PLACE PALM HERE';
        scanSubPrompt.textContent = 'HOLD TO VERIFY';
        statusMessage.textContent = 'SCAN ABORTED — TRY AGAIN';
        percentDisplay.textContent = '00%';
        progressBar.style.strokeDashoffset = CIRCUMFERENCE;

        playErrorBuzz();
        addLog('[WARN] Palm removed — scan aborted.', 'text-pink');
    }

    function completeScan() {
        isScanning = false;
        scannerPad.classList.remove('scanning', 'analyzing');

        percentDisplay.textContent = '100%';
        statusMessage.textContent = 'VERIFICATION COMPLETE ✓';
        scanPrompt.textContent = 'VERIFIED';
        scanSubPrompt.textContent = 'ACCESS GRANTED';

        playSuccessChime();
        addLog('[SCAN] Biometric verification: SUCCESS', 'text-green');
        addLog('[SYS] Generating participant passport...', 'text-cyan');

        // Randomize identity card data
        populateIdentityCard();

        // Show loading transition then the identity overlay
        setTimeout(() => {
            addLog('[SYS] VIP passport generated.', 'text-green');
            identityOverlay.classList.add('active');
            // drawPortrait(); // Disabled, using <img> tag for VIP portrait instead
        }, 900);
    }

    // ── Scanner event bindings ────────────────────────────────────────────

    // Mouse
    scannerPad.addEventListener('mousedown', (e) => { e.preventDefault(); startScan(); });
    scannerPad.addEventListener('mouseup', () => { if (scanProgress < 1) cancelScan(); });
    scannerPad.addEventListener('mouseleave', () => { if (isScanning && scanProgress < 1) cancelScan(); });

    // Touch
    scannerPad.addEventListener('touchstart', (e) => { e.preventDefault(); startScan(); }, { passive: false });
    scannerPad.addEventListener('touchend', () => { if (scanProgress < 1) cancelScan(); });
    scannerPad.addEventListener('touchcancel', () => { if (scanProgress < 1) cancelScan(); });

    // Keyboard accessibility globally
    document.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !identityOverlay.classList.contains('active')) {
            if (!e.repeat) {
                e.preventDefault();
                startScan();
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !identityOverlay.classList.contains('active')) {
            if (scanProgress < 1) cancelScan();
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    //  6. IDENTITY CARD — RANDOM DATA POPULATION
    // ══════════════════════════════════════════════════════════════════════

    const NAMES = [
        'DR. SARAH AISYAH', 'PROF. AHMAD FIRDAUS', 'EN. MOHD HARIZ',
        'DR. NUR IZZATI', 'TS. AMIRUL HAZIM', 'DR. WAN NURHIDAYAH',
        'PROF. RAJA SYAHIRA', 'EN. KHAIRUL ANWAR', 'DR. FARAH DIANA',
        'TS. MOHAMMAD ARIF', 'DR. SITI NURHALIZA', 'PROF. ZULKIFLI HASSAN',
    ];

    const CLUSTERS = [
        'GREEN TECH & SUSTAINABILITY',
        'TECHNOLOGY & ENTREPRENEURSHIP',
        'ADV. ENGINEERING & FABRICATION',
        'EDUCATION, TVET & HUMAN CAPITAL',
        'DIGITAL & SMART TECH (MADANI)',
        'HEALTH, BIOTECH & FOOD SECURITY',
        'SOCIAL INNOVATION & COMMUNITY',
    ];

    const CLASSES = [
        'STUDENT — UTHM', 'STAFF — UTHM', 'STUDENT — IPTA',
        'STUDENT — IPTS', 'STAFF — IPTA', 'INTERNATIONAL PARTICIPANT',
        'STUDENT — VOCATIONAL COLLEGE',
    ];

    function populateIdentityCard() {
        valName.textContent = 'PROF. Ts. Dr. RABIAH BINTI AHMAD, FASc';
        valFaction.textContent = 'GUEST OF HONOUR';
        valClass.textContent = 'DEPUTY VICE CHANCELLOR (RESEARCH AND INNOVATION)';

        cardIdTag.textContent = '#R26-VIP01';

        valHeartrate.textContent = '10–11 JUN';
        valMutation.textContent = 'DSI, UTHM';

        valThreat.textContent = 'OMEGA CLEARANCE';

        // Set max stats for VIP
        statSynaptic.style.width = '100%';
        statCyber.style.width = '100%';
        statCompliance.style.width = '100%';
    }

    // ══════════════════════════════════════════════════════════════════════
    //  7. PORTRAIT CANVAS — PROCEDURAL ABSTRACT FACE
    // ══════════════════════════════════════════════════════════════════════

    function drawPortrait() {
        const ctx = portraitCanvas.getContext('2d');
        const w = portraitCanvas.width;
        const h = portraitCanvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#060108';
        ctx.fillRect(0, 0, w, h);

        // Grid lines background
        ctx.strokeStyle = 'rgba(155, 0, 48, 0.12)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 8) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        }
        for (let j = 0; j < h; j += 8) {
            ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
        }

        const cx = w / 2;
        const cy = h / 2 - 5;

        // Head circle
        ctx.strokeStyle = 'rgba(200, 0, 62, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 10, 28, 35, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Shoulder line
        ctx.beginPath();
        ctx.moveTo(cx - 45, cy + 45);
        ctx.quadraticCurveTo(cx, cy + 30, cx + 45, cy + 45);
        ctx.lineTo(cx + 45, h);
        ctx.lineTo(cx - 45, h);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(200, 0, 62, 0.5)';
        ctx.stroke();

        // Eyes
        ctx.fillStyle = 'rgba(200, 0, 62, 0.8)';
        ctx.beginPath(); ctx.arc(cx - 10, cy - 13, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 10, cy - 13, 3, 0, Math.PI * 2); ctx.fill();

        // Nose line
        ctx.strokeStyle = 'rgba(200, 0, 62, 0.4)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - 3, cy + 2);
        ctx.lineTo(cx + 3, cy + 2);
        ctx.stroke();

        // Mouth
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 10);
        ctx.quadraticCurveTo(cx, cy + 14, cx + 8, cy + 10);
        ctx.strokeStyle = 'rgba(200, 0, 62, 0.5)';
        ctx.stroke();

        // Scan line overlay
        ctx.fillStyle = 'rgba(200, 0, 62, 0.03)';
        for (let y = 0; y < h; y += 3) {
            ctx.fillRect(0, y, w, 1);
        }

        // ID text
        ctx.font = '8px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(200, 0, 62, 0.6)';
        ctx.fillText('BIOMETRIC', 8, h - 18);
        ctx.fillText('VERIFIED ✓', 8, h - 8);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  8. RE-SCAN BUTTON — RESET FLOW
    // ══════════════════════════════════════════════════════════════════════

    btnRescan.addEventListener('click', () => {
        playPurgeSound();
        runResetLoadingScreen(() => {
            addLog('[SYS] Ready for next scan.', 'text-cyan');
            // Redirect to a specific link after completion
            window.location.href = "https://your-link-here.com"; 
        });

        // Hide the card and reset scanner behind the loading screen
        identityOverlay.classList.remove('active');
        scannerPad.classList.remove('scanning', 'analyzing');
        scanPrompt.textContent = 'PLACE PALM HERE';
        scanSubPrompt.textContent = 'HOLD TO VERIFY';
        statusMessage.textContent = 'RISE 2026 TERMINAL: STANDBY';
        percentDisplay.textContent = '00%';
        progressBar.style.strokeDashoffset = CIRCUMFERENCE;
        scanProgress = 0;

        addLog('[SYS] Session terminated. Purging cache...', 'text-pink');
    });

    // Allow pressing Spacebar to reload the scanner instead of clicking the button
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && identityOverlay.classList.contains('active')) {
            if (!e.repeat) {
                e.preventDefault();
                btnRescan.click();
            }
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    //  9. LINK INTEGRITY BAR — AMBIENT FLUCTUATION
    // ══════════════════════════════════════════════════════════════════════

    const linkBar = document.getElementById('link-integrity-bar');
    const linkVal = document.getElementById('link-integrity-value');

    function fluctuateLink() {
        if (!linkBar || !linkVal) return;
        const pct = 88 + Math.random() * 11;
        linkBar.style.width = pct.toFixed(1) + '%';
        // Keep the text as CLUSTER 5 (per RISE theme)
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INIT — BOOT SEQUENCE
    // ══════════════════════════════════════════════════════════════════════

    function init() {
        resizeCanvas();
        initParticles();
        drawParticles();
        updateClock();

        setInterval(updateClock, 1000);
        setInterval(streamAmbientLog, 5000);
        setInterval(fluctuateLink, 3000);

        window.addEventListener('resize', () => {
            resizeCanvas();
            initParticles();
        });

        // Start loading screen
        runLoadingScreen();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  10. PWA INSTALLATION LOGIC
    // ══════════════════════════════════════════════════════════════════════

    let deferredPrompt;
    const btnInstall = document.getElementById('btn-install');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show the install button
        if (btnInstall) {
            btnInstall.style.display = 'inline-block';
        }
    });

    if (btnInstall) {
        btnInstall.addEventListener('click', (e) => {
            if (!deferredPrompt) return;
            
            // Show the install prompt
            deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    addLog('[SYS] Terminal installation accepted.', 'text-green');
                } else {
                    addLog('[WARN] Terminal installation dismissed.', 'text-pink');
                }
                deferredPrompt = null;
                btnInstall.style.display = 'none';
            });
        });
    }

    // Service Worker Registration for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }

    // Go!
    init();
})();
