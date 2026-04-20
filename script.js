document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // 1. WEB AUDIO ENGINE
    // =============================================
    let audioCtx, droneOsc1, droneOsc2, droneFilter, droneGain, tensionOsc, tensionGain;
    let isAudioInitialized = false;

    function initAudio() {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        droneOsc1 = audioCtx.createOscillator();
        droneOsc2 = audioCtx.createOscillator();
        droneFilter = audioCtx.createBiquadFilter();
        droneGain = audioCtx.createGain();
        droneOsc1.type = 'sawtooth'; droneOsc2.type = 'square';
        droneOsc1.frequency.value = 55; droneOsc2.frequency.value = 55.5;
        droneFilter.type = 'lowpass'; droneFilter.frequency.value = 400;
        droneGain.gain.value = 0.08;
        droneOsc1.connect(droneFilter); droneOsc2.connect(droneFilter);
        droneFilter.connect(droneGain); droneGain.connect(audioCtx.destination);
        droneOsc1.start(); droneOsc2.start();

        tensionOsc = audioCtx.createOscillator();
        tensionGain = audioCtx.createGain();
        tensionOsc.type = 'triangle';
        tensionGain.gain.value = 0;
        tensionOsc.connect(tensionGain);
        tensionGain.connect(audioCtx.destination);
        tensionOsc.start();
        isAudioInitialized = true;
    }

    function playBlip(freq = 880, type = 'square', duration = 0.1, vol = 0.05) {
        if (!isAudioInitialized) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    }

    // =============================================
    // 2. CUSTOM CURSOR
    // =============================================
    const cursor = document.getElementById('custom-cursor');
    const follower = document.getElementById('cursor-follower');
    let mX = window.innerWidth / 2, mY = window.innerHeight / 2;
    let fX = mX, fY = mY;

    window.addEventListener('mousemove', (e) => {
        mX = e.clientX; mY = e.clientY;
        cursor.style.left = `${mX}px`; cursor.style.top = `${mY}px`;
        if (engine && engine.draggedNode && isAudioInitialized) {
            const dist = Math.hypot(mX - engine.dragStartX, mY - engine.dragStartY);
            tensionOsc.frequency.setValueAtTime(110 + (Math.min(1, dist / 300) * 400), audioCtx.currentTime);
            tensionGain.gain.setValueAtTime(Math.min(1, dist / 300) * 0.15, audioCtx.currentTime);
        }
    });

    function animateCursor() {
        fX += (mX - fX) * 0.15; fY += (mY - fY) * 0.15;
        follower.style.left = `${fX}px`; follower.style.top = `${fY}px`;
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.getElementById('btn-enter').addEventListener('click', () => {
        initAudio();
        document.getElementById('audio-unlock').classList.add('hidden');
        playBlip(440, 'sine', 0.5, 0.1);
    });

    ['button', 'input[type="range"]', '.sensory-trigger'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.addEventListener('mouseenter', () => {
                follower.classList.add('hover-active');
                if (el.classList.contains('sensory-trigger')) playBlip(1200, 'sine', 0.05, 0.02);
            });
            el.addEventListener('mouseleave', () => follower.classList.remove('hover-active'));
        });
    });

    // =============================================
    // 3. DATA REPOSITORY
    // =============================================
    const researchData = {
        intro:     { name: 'INTRODUCTION',    zoom: 1,   pos: { x: 0,    y: 0    }, ai: 10,  manual: 90 },
        alex:      { name: 'ALEX CASE STUDY', zoom: 2.2, pos: { x: 0.15, y: 0.15 }, ai: 90,  manual: 10 },
        an:        { name: 'AN ET AL (2025)',  zoom: 1.8, pos: { x: -0.2, y: -0.2 }, ai: 50,  manual: 85 },
        pilot:     { name: 'PILOT DECAY',     zoom: 1.5, pos: { x: 0.1,  y: -0.3 }, ai: 85,  manual: 15 },
        synthesis: { name: 'SYNTHESIS',       zoom: 1,   pos: { x: 0,    y: 0    }, ai: 15,  manual: 95 }
    };

    // =============================================
    // 4. MAIN CANVAS ENGINE
    // =============================================
    class SensoryEngine {
        constructor() {
            this.canvas = document.getElementById('hybrid-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.nodes = [];
            this.activeStudy = 'intro';
            this.zoom = 1; this.targetZoom = 1;
            this.offset = { x: 0, y: 0 }; this.targetOffset = { x: 0, y: 0 };
            this.ai = 10; this.manual = 90;
            this.burst = 0;
            this.draggedNode = null;
            this.dragStartX = 0; this.dragStartY = 0;
            this.resize();
            window.addEventListener('resize', () => this.resize());
            this.init();
            this.canvas.addEventListener('mousedown', (e) => this.onDown(e));
            document.addEventListener('mouseup', () => this.onUp());
            this.animate();
        }
        resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; this.init(); }
        init() {
            this.nodes = [];
            const count = Math.floor((window.innerWidth * window.innerHeight) / 25000);
            for (let i = 0; i < count; i++) {
                this.nodes.push({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height,
                    vx: (Math.random()-0.5), vy: (Math.random()-0.5), r: 2+Math.random()*3,
                    failed: false, ripple: 0, isDragging: false, ox: undefined, oy: undefined });
            }
        }
        setScene(sceneId) {
            this.activeStudy = sceneId;
            const d = researchData[sceneId];
            this.targetZoom = d.zoom; this.targetOffset = d.pos;
            if (sceneId !== 'alex' || !this.userOverrodeAlex) { this.ai = d.ai; this.manual = d.manual; }
            document.getElementById('hud-study-name').textContent = d.name;
            if (sceneId === 'pilot') this.triggerPilotFailure();
        }
        triggerPilotFailure() {
            if (this.activeStudy !== 'pilot') return;
            const h = this.nodes.filter(n => !n.failed);
            if (h.length) h[Math.floor(Math.random() * h.length)].failed = true;
            setTimeout(() => this.triggerPilotFailure(), 2500 + Math.random() * 2500);
        }
        getCanvasPos(cx, cy) {
            const w2 = this.canvas.width/2, h2 = this.canvas.height/2;
            return { x: (cx-w2)/this.zoom + w2 - this.offset.x*this.canvas.width, y: (cy-h2)/this.zoom + h2 - this.offset.y*this.canvas.height };
        }
        onDown(e) {
            const pos = this.getCanvasPos(e.clientX, e.clientY);
            const target = this.nodes.find(n => Math.hypot(n.x-pos.x, n.y-pos.y) < 30);
            if (target) {
                this.draggedNode = target; target.isDragging = true;
                target.ox = target.x; target.oy = target.y;
                this.dragStartX = e.clientX; this.dragStartY = e.clientY;
                follower.classList.add('drag-active');
            }
        }
        onUp() {
            if (this.draggedNode) {
                this.draggedNode.isDragging = false;
                this.draggedNode = null;
                follower.classList.remove('drag-active');
                if (isAudioInitialized) tensionGain.gain.setValueAtTime(0, audioCtx.currentTime);
                playBlip(200, 'triangle', 0.1, 0.05);
            }
        }
        triggerBurst() { this.burst = 2.0; }
        animate() {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = 'rgba(1, 2, 5, 0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalCompositeOperation = 'screen';
            this.zoom += (this.targetZoom - this.zoom) * 0.05;
            this.offset.x += (this.targetOffset.x - this.offset.x) * 0.05;
            this.offset.y += (this.targetOffset.y - this.offset.y) * 0.05;
            this.burst *= 0.95;
            const retention = Math.max(0, this.manual-(this.ai*0.4)).toFixed(1);
            const plasticity = Math.max(5, this.manual*0.9+(100-this.ai)*0.1).toFixed(1);
            document.getElementById('hud-retention').textContent = `${retention}%`;
            document.getElementById('hud-plasticity').textContent = `${Math.floor(plasticity)}%`;
            if (isAudioInitialized) droneFilter.frequency.setValueAtTime(100+(this.manual*8), audioCtx.currentTime);
            const colorRGB = retention < 40 ? '255,42,85' : '0,229,255';
            this.ctx.save();
            this.ctx.translate(this.canvas.width/2, this.canvas.height/2);
            this.ctx.scale(this.zoom, this.zoom);
            this.ctx.translate(-this.canvas.width/2+this.offset.x*this.canvas.width, -this.canvas.height/2+this.offset.y*this.canvas.height);
            this.nodes.forEach((n, i) => {
                if (n.isDragging) { const p = this.getCanvasPos(mX, mY); n.x = p.x; n.y = p.y; }
                else {
                    if (n.ox !== undefined) { n.vx += (n.ox-n.x)*0.05; n.vy += (n.oy-n.y)*0.05; if (Math.hypot(n.ox-n.x,n.oy-n.y)<2){n.ox=undefined;n.oy=undefined;} }
                    n.x += n.vx * (parseFloat(plasticity)/100 + this.burst);
                    n.y += n.vy * (parseFloat(plasticity)/100 + this.burst);
                    if (n.x < -50) n.x = this.canvas.width+50;
                    if (n.x > this.canvas.width+50) n.x = -50;
                    if (n.y < -50) n.y = this.canvas.height+50;
                    if (n.y > this.canvas.height+50) n.y = -50;
                }
                n.vx *= 0.96; n.vy *= 0.96;
                this.nodes.slice(i+1).forEach(t => {
                    const d = Math.hypot(n.x-t.x, n.y-t.y);
                    if (d < 180) {
                        const alpha = (1-d/180)*(retention/100)*0.6;
                        this.ctx.strokeStyle = (n.failed||t.failed) ? `rgba(255,42,85,${alpha*2})` : `rgba(${colorRGB},${alpha})`;
                        this.ctx.lineWidth = (n.isDragging||t.isDragging) ? 2 : 0.5+(this.manual/100)*1.5;
                        this.ctx.beginPath(); this.ctx.moveTo(n.x,n.y);
                        this.ctx.bezierCurveTo(n.x+(t.x-n.x)*0.3, n.y+(t.y-n.y)*0.8, n.x+(t.x-n.x)*0.7, n.y+(t.y-n.y)*0.2, t.x, t.y);
                        this.ctx.stroke();
                    }
                });
            });
            this.nodes.forEach(n => {
                this.ctx.fillStyle = n.failed ? 'rgba(255,42,85,0.9)' : `rgba(${colorRGB},${plasticity/100})`;
                this.ctx.beginPath();
                this.ctx.arc(n.x, n.y, n.r * (n.isDragging ? 2 : n.failed ? 1.5 : 1), 0, Math.PI*2);
                this.ctx.fill();
                if (n.ripple > 0) {
                    this.ctx.strokeStyle = `rgba(0,229,255,${n.ripple})`;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath(); this.ctx.arc(n.x, n.y, n.r+(1-n.ripple)*40, 0, Math.PI*2); this.ctx.stroke();
                    n.ripple -= 0.04;
                }
            });
            this.ctx.restore();
            requestAnimationFrame(() => this.animate());
        }
    }

    const engine = new SensoryEngine();

    // =============================================
    // 5. SCRUB-TO-REVEAL (Section 02)
    // =============================================
    const scrubCanvas = document.getElementById('scrub-canvas');
    const scrubCtx = scrubCanvas.getContext('2d');
    let scrubProgress = 0;
    let scrubCompleted = false;
    let isScrubbing = false;

    function initScrubCanvas() {
        const container = scrubCanvas.parentElement;
        scrubCanvas.width = container.offsetWidth;
        scrubCanvas.height = container.offsetHeight;
        // Fill with "fog"
        const grad = scrubCtx.createLinearGradient(0, 0, scrubCanvas.width, 0);
        grad.addColorStop(0, '#040810');
        grad.addColorStop(0.5, '#0a1220');
        grad.addColorStop(1, '#040810');
        scrubCtx.fillStyle = grad;
        scrubCtx.fillRect(0, 0, scrubCanvas.width, scrubCanvas.height);
        // "Fog" text hint
        scrubCtx.fillStyle = 'rgba(139,155,180,0.5)';
        scrubCtx.font = '0.7rem Inter, sans-serif';
        scrubCtx.textAlign = 'center';
        scrubCtx.fillText('SCRUB TO REVEAL HIDDEN DATA', scrubCanvas.width/2, scrubCanvas.height/2);
        scrubProgress = 0; scrubCompleted = false;
    }

    function scrubAt(x, y) {
        if (scrubCompleted) return;
        scrubCtx.globalCompositeOperation = 'destination-out';
        scrubCtx.beginPath();
        scrubCtx.arc(x, y, 28, 0, Math.PI * 2);
        scrubCtx.fill();
        scrubCtx.globalCompositeOperation = 'source-over';
        // Measure progress
        const data = scrubCtx.getImageData(0, 0, scrubCanvas.width, scrubCanvas.height).data;
        let transparent = 0;
        for (let i = 3; i < data.length; i += 4) { if (data[i] < 100) transparent++; }
        scrubProgress = transparent / (data.length / 4);
        if (scrubProgress > 0.5 && !scrubCompleted) {
            scrubCompleted = true;
            playBlip(1800, 'sine', 0.6, 0.12);
            // Boost global metrics for scrub effort
            engine.manual = Math.min(100, engine.manual + 15);
            engine.ai = Math.max(0, engine.ai - 10);
            engine.triggerBurst();
        }
    }

    scrubCanvas.addEventListener('mousedown', (e) => { isScrubbing = true; });
    scrubCanvas.addEventListener('mousemove', (e) => {
        if (!isScrubbing) return;
        const rect = scrubCanvas.getBoundingClientRect();
        scrubAt(e.clientX - rect.left, e.clientY - rect.top);
        playBlip(300 + Math.random() * 200, 'sine', 0.02, 0.005);
    });
    document.addEventListener('mouseup', () => { isScrubbing = false; });

    // Init after layout
    setTimeout(initScrubCanvas, 100);

    // =============================================
    // 6. AWARENESS RADAR mini-game (Section 03)
    // =============================================
    const radarGame = document.getElementById('radar-game');
    const radarDot = document.getElementById('radar-dot');
    let dotX = 50, dotY = 50; // Percent from center
    let driftVX = (Math.random() - 0.5) * 0.3;
    let driftVY = (Math.random() - 0.5) * 0.3;
    let isDraggingDot = false;
    let radarActive = false;
    let radarFailed = false;
    let radarDotMouseOffX = 0, radarDotMouseOffY = 0;

    function updateDotPosition() {
        const container = radarGame.getBoundingClientRect();
        const px = container.width/2 + (dotX/100)*(container.width/2 - 10);
        const py = container.height/2 + (dotY/100)*(container.height/2 - 10);
        radarDot.style.left = `${px}px`;
        radarDot.style.top = `${py}px`;
        radarDot.style.transform = 'translate(-50%, -50%)';
    }

    function radarLoop() {
        if (!radarActive) { requestAnimationFrame(radarLoop); return; }
        if (!isDraggingDot) {
            const dist = Math.hypot(dotX, dotY);
            // Drift speed increases with distance from center
            const accel = 0.004 + dist * 0.0005;
            driftVX += (dotX > 0 ? accel : -accel) * (Math.random() * 0.5 + 0.5);
            driftVY += (dotY > 0 ? accel : -accel) * (Math.random() * 0.5 + 0.5);
            driftVX *= 0.98; driftVY *= 0.98;
            dotX += driftVX;
            dotY += driftVY;
        }
        // Clamp to bounds
        const maxDist = 90;
        const curDist = Math.hypot(dotX, dotY);
        if (curDist > maxDist) {
            dotX = (dotX / curDist) * maxDist;
            dotY = (dotY / curDist) * maxDist;
        }
        // Update position
        updateDotPosition();
        // Style based on distance
        const norm = Math.hypot(dotX, dotY) / maxDist;
        const isFailing = norm > 0.7;
        radarDot.classList.toggle('failing', isFailing);
        // Audio: hum when drifting far
        if (isAudioInitialized) {
            const danger = Math.pow(norm, 2);
            droneOsc1.frequency.setValueAtTime(55 - danger * 25, audioCtx.currentTime); // Pitch droops
        }
        // Global metric decay when failing
        if (isFailing && !isDraggingDot) engine.manual = Math.max(0, engine.manual - 0.05);
        requestAnimationFrame(radarLoop);
    }
    radarLoop();

    radarDot.addEventListener('mousedown', (e) => {
        isDraggingDot = true;
        follower.classList.add('drag-active');
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingDot) return;
        const rect = radarGame.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width/2;
        const relY = e.clientY - rect.top - rect.height/2;
        // Convert to percentage (-100 to 100)
        dotX = (relX / (rect.width/2)) * 100;
        dotY = (relY / (rect.height/2)) * 100;
        // Give a blip when moving toward center
        const d = Math.hypot(dotX, dotY);
        if (d < 10) { playBlip(1600, 'sine', 0.1, 0.05); engine.manual = Math.min(100, engine.manual + 1); engine.triggerBurst(); }
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingDot) {
            isDraggingDot = false; follower.classList.remove('drag-active');
            // Reset drift when released
            driftVX = (Math.random() - 0.5) * 0.2;
            driftVY = (Math.random() - 0.5) * 0.2;
        }
    });

    // =============================================
    // 7. SCENE OBSERVER
    // =============================================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
                const id = entry.target.getAttribute('data-study');
                engine.setScene(id);
                updateSidebar(id);
                radarActive = (id === 'pilot');
            }
        });
    }, { threshold: 0.4 });

    document.querySelectorAll('.scene-block').forEach(s => observer.observe(s));

    function updateSidebar(id) {
        document.querySelectorAll('.index-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(id)) item.classList.add('active');
        });
    }

    window.scrollToScene = (id) => document.getElementById(`scene-${id}`).scrollIntoView({ behavior: 'smooth' });

    document.querySelectorAll('.sensory-trigger').forEach(trigger => {
        trigger.addEventListener('mouseenter', () => engine.triggerBurst());
    });

    // =============================================
    // 8. ALEX SLIDER
    // =============================================
    const alexSlider = document.getElementById('slider-alex');
    const alexRet = document.getElementById('alex-retention');
    alexSlider.addEventListener('input', () => {
        engine.userOverrodeAlex = true;
        const val = parseInt(alexSlider.value);
        const ret = Math.max(0, 100 - val * 1.1);
        alexRet.textContent = `${Math.floor(ret)}%`;
        alexRet.style.color = ret < 30 ? 'var(--danger)' : '#fff';
        engine.ai = val; engine.manual = 100 - val;
        if (val % 5 === 0) playBlip(600 + val * 2, 'square', 0.05, 0.02);
    });

});
