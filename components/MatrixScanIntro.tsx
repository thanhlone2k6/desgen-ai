import React, { useEffect, useRef, useState } from 'react';

type MatrixScanIntroProps = {
  durationMs?: number;
  onDone?: () => void;
  title?: string;
};

// Matrix characters (katakana, numbers, symbols)
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+=<>?';

interface MatrixColumn {
  x: number;
  chars: string[];
  speed: number;
  y: number;
  depth: number;
  refreshRate: number;
  lastRefresh: number;
}

interface EnergyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

const MatrixScanIntro: React.FC<MatrixScanIntroProps> = ({
  durationMs = 6000,
  onDone,
  title = 'DesGen AI Pro',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const columnsRef = useRef<MatrixColumn[]>([]);
  const particlesRef = useRef<EnergyParticle[]>([]);
  const onDoneRef = useRef(onDone);
  
  // Timeline states for CSS transitions
  const [phase, setPhase] = useState<'intro' | 'main' | 'fadeout'>('intro');
  const [containerOpacity, setContainerOpacity] = useState(0);
  const [titleOpacity, setTitleOpacity] = useState(0);
  const [titleGlow, setTitleGlow] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  onDoneRef.current = onDone;

  // Timeline control
  useEffect(() => {
    const startTime = performance.now();
    
    // Phase timings (simplified - no separate credit phase)
    const INTRO_END = 1000;      // 0-1s: fade in
    const MAIN_END = 5000;       // 1-5s: main animation
    const FADE_START = 5500;     // 5.5s: start fade out
    
    let lastPhase = 'intro';
    
    const updatePhase = () => {
      const elapsed = performance.now() - startTime;
      
      if (elapsed < INTRO_END) {
        // Intro phase: 0-1s - fade in mượt
        const progress = elapsed / INTRO_END;
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        setContainerOpacity(eased);
        setTitleOpacity(eased);
        setTitleGlow(eased);
        if (lastPhase !== 'intro') {
          setPhase('intro');
          lastPhase = 'intro';
        }
      } else if (elapsed < MAIN_END) {
        // Main phase: 1-5s - hiệu ứng chính
        if (lastPhase !== 'main') {
          setPhase('main');
          setContainerOpacity(1);
          setTitleOpacity(1);
          lastPhase = 'main';
        }
        // Pulse glow during main phase
        const pulse = Math.sin((elapsed - INTRO_END) * 0.008) * 0.3 + 0.7;
        setTitleGlow(pulse);
      } else if (elapsed < durationMs) {
        // Fade-out: 5.5-6s
        if (lastPhase !== 'fadeout') {
          setPhase('fadeout');
          lastPhase = 'fadeout';
        }
        const progress = (elapsed - FADE_START) / (durationMs - FADE_START);
        const eased = Math.max(0, Math.min(1, progress));
        setContainerOpacity(1 - eased);
        setTitleOpacity(1 - eased);
        setTitleGlow((1 - eased) * 0.5);
      } else {
        // Done
        setIsVisible(false);
        onDoneRef.current?.();
        return;
      }
      
      requestAnimationFrame(updatePhase);
    };
    
    requestAnimationFrame(updatePhase);
    
    return () => {};
  }, [durationMs]);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    const setupCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      initColumns();
    };

    const initColumns = () => {
      const fontSize = 14;
      const columnCount = Math.floor(width / fontSize) + 10;
      columnsRef.current = [];

      for (let i = 0; i < columnCount; i++) {
        const depth = Math.random();
        let depthLevel = 0;
        if (depth > 0.3 && depth <= 0.7) depthLevel = 1;
        else if (depth > 0.7) depthLevel = 2;

        const charCount = Math.floor(height / fontSize) + 5;
        const chars: string[] = [];
        for (let j = 0; j < charCount; j++) {
          chars.push(MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]);
        }

        columnsRef.current.push({
          x: i * fontSize - fontSize * 5,
          chars,
          speed: 0.3 + Math.random() * 0.4 + depthLevel * 0.2,
          y: Math.random() * height - height,
          depth: depthLevel,
          refreshRate: 50 + Math.random() * 100,
          lastRefresh: 0,
        });
      }
    };

    setupCanvas();

    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);

    const startTime = performance.now();
    let isStopped = false;
    let lastTime = startTime;

    const scanY = height / 2;

    const draw = (timestamp: number) => {
      if (isStopped) return;

      const elapsed = timestamp - startTime;
      const dt = timestamp - lastTime;
      lastTime = timestamp;

      // Intro fade factor (0-1s: 0→1)
      const introFade = Math.min(1, elapsed / 1000);
      // Matrix density grows during intro
      const densityFactor = 0.3 + introFade * 0.7;

      // Clear canvas
      ctx.fillStyle = '#05060A';
      ctx.fillRect(0, 0, width, height);

      const fontSize = 14;
      ctx.font = `${fontSize}px "JetBrains Mono", "SF Mono", "Consolas", monospace`;

      // Pulse calculations
      const pulseFreq = 8;
      const pulse = Math.sin(elapsed * pulseFreq * 0.01) * 0.5 + 0.5;
      const fastPulse = Math.sin(elapsed * 0.02) * 0.3 + 0.7;

      // Scan glow intensity (fades in during intro)
      const scanIntensity = introFade;

      // Update particles
      for (const col of columnsRef.current) {
        col.y += col.speed * (dt * 0.03);
        if (col.y > height + fontSize * 5) {
          col.y = -fontSize * col.chars.length;
        }

        if (elapsed - col.lastRefresh > col.refreshRate) {
          col.lastRefresh = elapsed;
          for (let i = 0; i < col.chars.length; i++) {
            if (Math.random() < 0.3) {
              col.chars[i] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
            }
          }
        }

        const baseAlpha = col.depth === 0 ? 0.15 : col.depth === 1 ? 0.35 : 0.6;
        const colorHue = col.depth === 2 ? '180, 100%' : '260, 80%';

        for (let i = 0; i < col.chars.length; i++) {
          const charY = col.y + i * fontSize;
          if (charY < -fontSize || charY > height + fontSize) continue;

          // Skip some chars during intro for "density growing" effect
          if (Math.random() > densityFactor && elapsed < 1000) continue;

          const distFromScan = Math.abs(charY - scanY);
          let alpha = baseAlpha * introFade;
          let glowBoost = 0;

          if (distFromScan < 100) {
            glowBoost = (1 - distFromScan / 100) * pulse * 0.5 * scanIntensity;
            alpha += glowBoost;
          }

          const headDist = i / col.chars.length;
          if (headDist < 0.15) {
            alpha = Math.min(1, alpha + 0.4);
          }

          ctx.fillStyle = `hsla(${colorHue}, 70%, ${alpha})`;
          ctx.fillText(col.chars[i], col.x, charY);
        }
      }

      // Energy ripples (intensity based on intro fade)
      const waveCount = 5;
      const waveSpacing = 20;
      
      for (let w = 0; w < waveCount; w++) {
        const waveOffset = w * waveSpacing;
        const waveAlpha = (1 - w / waveCount) * 0.3 * fastPulse * scanIntensity;
        const amplitude = (15 + w * 8) * pulse;
        
        ctx.beginPath();
        ctx.strokeStyle = `rgba(139, 92, 246, ${waveAlpha})`;
        ctx.lineWidth = 2 - w * 0.3;
        
        for (let x = 0; x <= width; x += 3) {
          const waveY = scanY - waveOffset - 40 - Math.sin((x + elapsed * 0.1) * 0.02) * amplitude;
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(6, 182, 212, ${waveAlpha})`;
        for (let x = 0; x <= width; x += 3) {
          const waveY = scanY + waveOffset + 40 + Math.sin((x + elapsed * 0.1 + Math.PI) * 0.02) * amplitude;
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }

      // Energy particles
      if (Math.random() < 0.3 * scanIntensity) {
        const side = Math.random() > 0.5 ? 1 : -1;
        particlesRef.current.push({
          x: width / 2 + (Math.random() - 0.5) * width * 0.8,
          y: scanY + side * (30 + Math.random() * 20),
          vx: (Math.random() - 0.5) * 2,
          vy: side * (1 + Math.random() * 2),
          life: 0,
          maxLife: 500 + Math.random() * 500,
          size: 1 + Math.random() * 2,
        });
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life += dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.98;
        p.vx *= 0.98;

        if (p.life > p.maxLife) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        const alpha = Math.sin(lifeRatio * Math.PI) * 0.8 * scanIntensity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 200, 255, ${alpha})`;
        ctx.fill();
      }

      // Scan line (intensity fades in)
      const glowWidth = (100 + pulse * 40) * scanIntensity;
      
      const scanGlow = ctx.createLinearGradient(0, scanY - glowWidth, 0, scanY + glowWidth);
      scanGlow.addColorStop(0, 'transparent');
      scanGlow.addColorStop(0.3, `rgba(139, 92, 246, ${0.05 * fastPulse * scanIntensity})`);
      scanGlow.addColorStop(0.45, `rgba(6, 182, 212, ${0.15 * fastPulse * scanIntensity})`);
      scanGlow.addColorStop(0.5, `rgba(200, 240, 255, ${0.4 * pulse * scanIntensity})`);
      scanGlow.addColorStop(0.55, `rgba(6, 182, 212, ${0.15 * fastPulse * scanIntensity})`);
      scanGlow.addColorStop(0.7, `rgba(139, 92, 246, ${0.05 * fastPulse * scanIntensity})`);
      scanGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGlow;
      ctx.fillRect(0, scanY - glowWidth, width, glowWidth * 2);

      // Core line
      const coreAlpha = (0.7 + pulse * 0.3) * scanIntensity;
      ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha})`;
      ctx.fillRect(0, scanY - 1, width, 2);

      // Flares
      const flareCount = 3;
      for (let i = 0; i < flareCount; i++) {
        const flareX = (Math.sin(elapsed * 0.003 + i * 2) * 0.5 + 0.5) * width;
        const flareSize = (30 + pulse * 20) * scanIntensity;
        
        const flareGrad = ctx.createRadialGradient(flareX, scanY, 0, flareX, scanY, flareSize);
        flareGrad.addColorStop(0, `rgba(255, 255, 255, ${0.6 * pulse * scanIntensity})`);
        flareGrad.addColorStop(0.3, `rgba(6, 182, 212, ${0.3 * pulse * scanIntensity})`);
        flareGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flareGrad;
        ctx.fillRect(flareX - flareSize, scanY - flareSize, flareSize * 2, flareSize * 2);
      }

      // Vignette
      const vignetteGrad = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.25,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignetteGrad.addColorStop(0, 'transparent');
      vignetteGrad.addColorStop(0.6, 'transparent');
      vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, width, height);

      if (elapsed < durationMs) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      isStopped = true;
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [durationMs]);

  if (!isVisible) return null;

  const glowIntensity = 20 + titleGlow * 40;
  const textShadow = `
    0 0 ${glowIntensity}px rgba(6, 182, 212, ${0.9 * titleGlow}),
    0 0 ${glowIntensity * 2}px rgba(6, 182, 212, ${0.6 * titleGlow}),
    0 0 ${glowIntensity * 3}px rgba(139, 92, 246, ${0.4 * titleGlow}),
    0 0 ${glowIntensity * 4}px rgba(139, 92, 246, ${0.2 * titleGlow})
  `;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        opacity: containerOpacity,
        backgroundColor: '#05060A',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
      
      {/* Title overlay */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          opacity: titleOpacity,
          transition: 'opacity 0.1s ease-out',
        }}
      >
        {/* Quotation marks */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span
            style={{
              position: 'absolute',
              top: '-40px',
              left: '-50px',
              fontSize: '80px',
              fontFamily: 'Georgia, serif',
              color: `rgba(6, 182, 212, ${0.3 * titleGlow})`,
              textShadow: `0 0 20px rgba(6, 182, 212, ${0.5 * titleGlow})`,
              transition: 'all 0.1s ease-out',
            }}
          >
            "
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: '-60px',
              right: '-50px',
              fontSize: '80px',
              fontFamily: 'Georgia, serif',
              color: `rgba(139, 92, 246, ${0.3 * titleGlow})`,
              textShadow: `0 0 20px rgba(139, 92, 246, ${0.5 * titleGlow})`,
              transition: 'all 0.1s ease-out',
            }}
          >
            "
          </span>
          
          <h1
            style={{
              fontSize: 'clamp(32px, 8vw, 72px)',
              fontFamily: '"Orbitron", "Rajdhani", "Audiowide", sans-serif',
              fontWeight: 900,
              color: '#ffffff',
              textShadow,
              margin: 0,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              WebkitTextStroke: `1px rgba(6, 182, 212, ${0.5 * titleGlow})`,
              transition: 'all 0.1s ease-out',
            }}
          >
            {title}
          </h1>
          
          {/* Subtitle */}
          <p
            style={{
              marginTop: '16px',
              fontSize: '12px',
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
              fontWeight: 400,
              color: `rgba(148, 163, 184, ${0.6 * titleGlow})`,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              textShadow: `0 0 10px rgba(6, 182, 212, ${0.3 * titleGlow})`,
              transition: 'all 0.1s ease-out',
            }}
          >
            AI-Powered Design Generator
          </p>
        </div>
      </div>

    </div>
  );
};

export default MatrixScanIntro;
