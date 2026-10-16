/**
 * Prism Waves - Flowing diagonal light ribbons
 * Static waves that only respond to scroll and cursor - no self-animation
 */

export function initPrismWaves(container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'prism-waves-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    let scrollProgress = 0;
    let targetScrollProgress = 0;
    let animationId;
    let needsRedraw = true;

    // Wave configuration - thicker, visible ribbons
    const waves = [
        {
            offset: 0.12,
            color: 'rgba(255, 140, 140, 0.15)',
            width: 3,
            amplitude: 35,
            frequency: 0.008,
            scrollInfluence: 1.0,
            cursorInfluence: 0.12
        },
        {
            offset: 0.28,
            color: 'rgba(255, 200, 120, 0.12)',
            width: 2.5,
            amplitude: 45,
            frequency: 0.006,
            scrollInfluence: 0.8,
            cursorInfluence: 0.10
        },
        {
            offset: 0.44,
            color: 'rgba(150, 255, 180, 0.10)',
            width: 3,
            amplitude: 40,
            frequency: 0.007,
            scrollInfluence: 0.6,
            cursorInfluence: 0.08
        },
        {
            offset: 0.60,
            color: 'rgba(140, 200, 255, 0.12)',
            width: 2.5,
            amplitude: 50,
            frequency: 0.005,
            scrollInfluence: 0.4,
            cursorInfluence: 0.06
        },
        {
            offset: 0.76,
            color: 'rgba(180, 140, 255, 0.11)',
            width: 2,
            amplitude: 38,
            frequency: 0.009,
            scrollInfluence: 0.3,
            cursorInfluence: 0.05
        }
    ];

    function resize() {
        const rect = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        needsRedraw = true;
    }

    function drawWave(wave) {
        // Fade based on scroll
        const scrollFade = Math.max(0.4, 1 - scrollProgress * 0.4);

        // Cursor influence - gentle displacement
        const cursorOffsetX = (mouseX - 0.5) * 60 * wave.cursorInfluence;
        const cursorOffsetY = (mouseY - 0.5) * 40 * wave.cursorInfluence;

        // Scroll-driven wave phase shift
        const scrollPhase = scrollProgress * Math.PI * 2 * wave.scrollInfluence;

        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = wave.width;
        ctx.lineCap = 'round';
        ctx.globalAlpha = scrollFade;

        const diagonal = Math.sqrt(width * width + height * height) * 1.8;
        const steps = 250;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // Base position along diagonal - extended to fill full container
            const baseX = -width * 0.3 + t * (width * 1.6);
            const baseY = -height * 0.3 + t * (height * 1.6);

            // Wave offset perpendicular to diagonal
            const waveOffset = wave.offset * Math.min(width, height) * 0.8;

            // Static wave shape - only phase shifts with scroll
            const phase1 = t * diagonal * wave.frequency + scrollPhase;
            const phase2 = t * diagonal * wave.frequency * 0.5 + scrollPhase * 0.7;
            const phase3 = t * diagonal * wave.frequency * 0.25 + scrollPhase * 0.4;

            const undulation =
                Math.sin(phase1) * wave.amplitude +
                Math.sin(phase2) * wave.amplitude * 0.4 +
                Math.sin(phase3) * wave.amplitude * 0.2;

            // Perpendicular offset (roughly 45 degrees rotated)
            const perpX = -undulation * 0.707 + waveOffset * 0.707;
            const perpY = undulation * 0.707 + waveOffset * 0.707;

            const x = baseX + perpX + cursorOffsetX;
            const y = baseY + perpY + cursorOffsetY;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function draw() {
        // Smooth interpolation for cursor and scroll
        const prevMouseX = mouseX;
        const prevMouseY = mouseY;
        const prevScroll = scrollProgress;

        mouseX += (targetMouseX - mouseX) * 0.08;
        mouseY += (targetMouseY - mouseY) * 0.08;
        scrollProgress += (targetScrollProgress - scrollProgress) * 0.1;

        // Only redraw if something changed
        const mouseMoved = Math.abs(mouseX - prevMouseX) > 0.001 || Math.abs(mouseY - prevMouseY) > 0.001;
        const scrolled = Math.abs(scrollProgress - prevScroll) > 0.001;

        if (needsRedraw || mouseMoved || scrolled) {
            ctx.clearRect(0, 0, width, height);
            waves.forEach(wave => drawWave(wave));
            needsRedraw = false;
        }

        animationId = requestAnimationFrame(draw);
    }

    function handleMouseMove(e) {
        targetMouseX = e.clientX / window.innerWidth;
        targetMouseY = e.clientY / window.innerHeight;
    }

    function handleScroll() {
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        if (rect.top < viewportHeight && rect.bottom > 0) {
            const visibleTop = Math.max(0, -rect.top);
            targetScrollProgress = Math.min(1, visibleTop / rect.height);
        }
    }

    // Initialize
    resize();
    handleScroll(); // Get initial scroll position
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Start render loop
    animationId = requestAnimationFrame(draw);

    // Return cleanup function
    return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('scroll', handleScroll);
        canvas.remove();
    };
}
