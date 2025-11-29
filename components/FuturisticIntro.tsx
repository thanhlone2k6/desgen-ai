import React, { useEffect, useRef, useState } from 'react';

interface FuturisticIntroProps {
  durationMs?: number;
  onDone?: () => void;
}

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  brightness: number; // 0: very dim, 1: medium, 2: bright
}

interface CodeChar {
  text: string;
  x: number;
  y: number;
  alpha: number;
  targetAlpha: number;
  vy: number;
  life: number;
  maxLife: number;
  glitchTimer: number;
  originalText: string;
}

const CODE_TOKENS = [
  'rendering…', 'latent → pixels', 'noise schedule', 'seed=8342',
  'diffusion step', 'attention: 0.87', 'token[512]', 'encode()',
  '0x7F3A', '10110101', 'sampling...', 'denoise: 0.23',
  'prompt_embed', 'cfg=7.5', 'steps=28', 'inference',
  'vae.decode', 'unet.forward', 'scheduler', 'latent_dim=4',
];

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789';

export const FuturisticIntro: React.FC<FuturisticIntroProps> = ({
  durationMs = 5000,
  onDone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(1);
  const [isVisible, setIsVisible] = useState(true);
  
  const onDoneRef = useRef(onDone);
  const rafRef = useRef<number>();
  
  onDoneRef.current = onDone;

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
    };
    setupCanvas();

    // Initialize particles (flux dust) - 200 particles
    const particleCount = 200;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const rand = Math.random();
      let brightness = 0; // 70% very dim
      if (rand > 0.7 && rand <= 0.95) brightness = 1; // 25% medium
      else if (rand > 0.95) brightness = 2; // 5% bright
      
      particles.push({
        x, y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 1.5 + 0.5,
        alpha: brightness === 0 ? 0.08 : brightness === 1 ? 0.2 : 0.4,
        brightness,
      });
    }

    // Code trail characters
    const codeChars: CodeChar[] = [];

    // Flux breathing state
    let fluxPhase = 0;
    let fluxCycle = 0;
    const fluxPeriod = 2000; // 2s per breath cycle

    // Logo pulse
    let logoPulse = 0;

    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);

    const startTime = performance.now();
    let isStopped = false;

    // Timeline constants
    const DUST_FADE_IN = 600;
    const FLUX_START = 600;
    const SCAN_START = 1600;
    const SCAN_END = 3200;
    const TAGLINE_START = 3400;
    const FADE_START = 4400;

    const logoY = height / 2 - 15;
    const taglineY = height / 2 + 45;
    const byY = height / 2 + 85;

    const draw = (timestamp: number) => {
      if (isStopped) return;

      const elapsed = timestamp - startTime;
      const dt = 16; // Approximate frame time

      // Update flux breathing
      fluxPhase = ((elapsed - FLUX_START) % fluxPeriod) / fluxPeriod;
      fluxCycle = Math.sin(fluxPhase * Math.PI * 2) * 0.5 + 0.5; // 0 to 1

      // Logo pulse (3-4s period)
      logoPulse = Math.sin(elapsed / 3500 * Math.PI * 2) * 0.5 + 0.5;

      // Calculate scan position
      let scanY = -100;
      let scanProgress = 0;
      if (elapsed > SCAN_START && elapsed < SCAN_END) {
        scanProgress = (elapsed - SCAN_START) / (SCAN_END - SCAN_START);
        const eased = scanProgress < 0.5 
          ? 2 * scanProgress * scanProgress 
          : 1 - Math.pow(-2 * scanProgress + 2, 2) / 2;
        scanY = -80 + (height + 160) * eased;
        
        // Add micro jitter
        scanY += Math.sin(elapsed * 0.05) * 1.5;
      } else if (elapsed >= SCAN_END) {
        scanY = height + 100;
        scanProgress = 1;
      }

      // Clear canvas
      ctx.fillStyle = '#05060A';
      ctx.fillRect(0, 0, width, height);

      // Dust fade-in
      const dustAlpha = Math.min(1, elapsed / DUST_FADE_IN);

      // Draw subtle radial gradient background
      const bgGrad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      bgGrad.addColorStop(0, `rgba(139, 92, 246, ${0.025 * dustAlpha})`);
      bgGrad.addColorStop(0.5, `rgba(59, 130, 246, ${0.015 * dustAlpha})`);
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Calculate flux attraction center (breathing)
      const attractStrength = elapsed > FLUX_START ? fluxCycle * 0.3 : 0;

      // Update particles
      for (const p of particles) {
        // Base drift
        p.x += p.vx;
        p.y += p.vy;

        // Flux breathing - attract towards clusters
        if (attractStrength > 0) {
          const centerX = width / 2 + Math.sin(elapsed * 0.0005) * 100;
          const centerY = height / 2 + Math.cos(elapsed * 0.0003) * 80;
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 50 && dist < 400) {
            p.x += (dx / dist) * attractStrength * 0.5;
            p.y += (dy / dist) * attractStrength * 0.5;
          }
        }

        // Wrap around
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }

      // Draw particle connections (constellation lines)
      const lineRadius = 100 + fluxCycle * 40; // 80-140px
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < lineRadius) {
            let lineAlpha = (1 - dist / lineRadius) * 0.08 * dustAlpha;
            
            // Brighten near scan
            const avgY = (particles[i].y + particles[j].y) / 2;
            const distToScan = Math.abs(avgY - scanY);
            if (distToScan < 100 && elapsed > SCAN_START) {
              lineAlpha += (1 - distToScan / 100) * 0.15;
            }

            // Flux breathing intensity
            lineAlpha *= (0.5 + fluxCycle * 0.5);

            ctx.strokeStyle = `rgba(100, 180, 255, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        let alpha = p.alpha * dustAlpha;
        
        // Brighten near scan line
        const distToScan = Math.abs(p.y - scanY);
        if (distToScan < 80 && elapsed > SCAN_START) {
          alpha += (1 - distToScan / 80) * 0.3;
        }

        const hue = p.brightness === 2 ? '180, 100%, 80%' : '220, 80%, 70%';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${alpha})`;
        ctx.fill();
      }

      // Generate code trail characters
      if (elapsed > SCAN_START && elapsed < SCAN_END && Math.random() < 0.15) {
        const token = CODE_TOKENS[Math.floor(Math.random() * CODE_TOKENS.length)];
        codeChars.push({
          text: token,
          originalText: token,
          x: Math.random() * width * 0.8 + width * 0.1,
          y: scanY + 20 + Math.random() * 30,
          alpha: 0,
          targetAlpha: 0.4 + Math.random() * 0.3,
          vy: 0.3 + Math.random() * 0.2,
          life: 0,
          maxLife: 1500 + Math.random() * 1000,
          glitchTimer: Math.random() < 0.2 ? 200 : 0, // 20% chance to glitch
        });
      }

      // Update and draw code trail
      ctx.font = '11px "JetBrains Mono", "SF Mono", "Consolas", monospace';
      ctx.textAlign = 'left';
      
      for (let i = codeChars.length - 1; i >= 0; i--) {
        const c = codeChars[i];
        c.life += dt;
        c.y += c.vy;

        // Fade in fast, fade out slow
        if (c.life < 100) {
          c.alpha = (c.life / 100) * c.targetAlpha;
        } else if (c.life > c.maxLife - 500) {
          c.alpha = c.targetAlpha * ((c.maxLife - c.life) / 500);
        }

        // Glitch effect
        if (c.glitchTimer > 0) {
          c.glitchTimer -= dt;
          if (Math.random() < 0.3) {
            const glitchIdx = Math.floor(Math.random() * c.originalText.length);
            const glitchChar = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            c.text = c.originalText.substring(0, glitchIdx) + glitchChar + c.originalText.substring(glitchIdx + 1);
          }
        } else {
          c.text = c.originalText;
        }

        // Remove dead chars
        if (c.life > c.maxLife || c.alpha <= 0) {
          codeChars.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(139, 92, 246, ${c.alpha})`;
        ctx.fillText(c.text, c.x, c.y);
      }

      // Draw scan line
      if (elapsed > SCAN_START && scanY > -80 && scanY < height + 80) {
        // Wide glow band (80-140px)
        const glowHeight = 120;
        const scanGlow = ctx.createLinearGradient(0, scanY - glowHeight/2, 0, scanY + glowHeight/2);
        scanGlow.addColorStop(0, 'transparent');
        scanGlow.addColorStop(0.3, 'rgba(139, 92, 246, 0.05)');
        scanGlow.addColorStop(0.45, 'rgba(59, 130, 246, 0.12)');
        scanGlow.addColorStop(0.5, 'rgba(120, 200, 255, 0.2)');
        scanGlow.addColorStop(0.55, 'rgba(59, 130, 246, 0.12)');
        scanGlow.addColorStop(0.7, 'rgba(139, 92, 246, 0.05)');
        scanGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = scanGlow;
        ctx.fillRect(0, scanY - glowHeight/2, width, glowHeight);

        // Core line (1-2px) with chromatic aberration
        // Red channel offset
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.fillRect(0, scanY - 1.5, width, 1);
        // Blue channel offset
        ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';
        ctx.fillRect(0, scanY + 0.5, width, 1);
        // White core
        ctx.fillStyle = 'rgba(200, 240, 255, 0.9)';
        ctx.fillRect(0, scanY - 0.5, width, 1);
      }

      // Logo reveal calculation
      const getRevealAmount = (textY: number, textHeight: number = 60) => {
        if (scanY < textY - textHeight / 2) return 0;
        if (scanY > textY + textHeight / 2 + 50) return 1;
        return Math.min(1, (scanY - (textY - textHeight / 2)) / (textHeight + 50));
      };

      // Draw logo shadow (always visible after flux start, very dim)
      if (elapsed > FLUX_START) {
        const shadowAlpha = Math.min(0.08, (elapsed - FLUX_START) / 2000 * 0.08);
        ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(255, 255, 255, ${shadowAlpha})`;
        ctx.fillText('DesignGen Pro', width / 2, logoY);
      }

      // Draw revealed logo
      const logoReveal = getRevealAmount(logoY, 50);
      if (logoReveal > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, scanY + 30);
        ctx.clip();

        const distToScan = Math.abs(logoY - scanY);
        const glowBoost = distToScan < 60 ? (1 - distToScan / 60) : 0;
        const baseGlow = scanProgress >= 1 ? (0.6 + logoPulse * 0.15) : 0.6;

        ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outer glow (purple)
        ctx.shadowBlur = 50 + glowBoost * 30;
        ctx.shadowColor = `rgba(139, 92, 246, ${baseGlow + glowBoost * 0.3})`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('DesignGen Pro', width / 2, logoY);

        // Inner glow (cyan)
        ctx.shadowBlur = 20 + glowBoost * 15;
        ctx.shadowColor = `rgba(6, 182, 212, ${0.4 + glowBoost * 0.3})`;
        ctx.fillText('DesignGen Pro', width / 2, logoY);

        ctx.restore();
      }

      // Draw tagline (type-on or fade-in after TAGLINE_START)
      if (elapsed > TAGLINE_START) {
        const taglineProgress = Math.min(1, (elapsed - TAGLINE_START) / 800);
        const taglineText = 'Imagine it. We generate it.';
        const visibleChars = Math.floor(taglineText.length * taglineProgress);
        const displayText = taglineText.substring(0, visibleChars);

        ctx.font = '300 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
        ctx.fillStyle = `rgba(203, 213, 225, ${0.85})`;
        ctx.fillText(displayText, width / 2, taglineY);
        
        // Cursor blink
        if (taglineProgress < 1 && Math.floor(elapsed / 400) % 2 === 0) {
          const metrics = ctx.measureText(displayText);
          ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
          ctx.fillRect(width / 2 + metrics.width / 2 + 2, taglineY - 8, 2, 16);
        }
      }

      // Draw "By ThanhNg"
      if (elapsed > TAGLINE_START + 400) {
        const byProgress = Math.min(1, (elapsed - TAGLINE_START - 400) / 600);
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.3)';
        ctx.fillStyle = `rgba(148, 163, 184, ${0.7 * byProgress})`;
        ctx.fillText('By ThanhNg', width / 2, byY);
      }

      // Draw noise overlay (film grain 2-3%)
      if (dustAlpha > 0.5) {
        const noiseAlpha = 0.025;
        const imageData = ctx.getImageData(0, 0, width * dpr, height * dpr);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 16) { // Skip pixels for performance
          const noise = (Math.random() - 0.5) * 25;
          data[i] = Math.min(255, Math.max(0, data[i] + noise * noiseAlpha));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * noiseAlpha));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * noiseAlpha));
        }
        ctx.putImageData(imageData, 0, 0);
      }

      // Draw vignette
      const vignetteGrad = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.3,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignetteGrad.addColorStop(0, 'transparent');
      vignetteGrad.addColorStop(0.7, 'transparent');
      vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, width, height);

      // Fade out
      if (elapsed >= FADE_START) {
        const fadeProgress = (elapsed - FADE_START) / (durationMs - FADE_START);
        if (fadeProgress >= 1) {
          isStopped = true;
          setIsVisible(false);
          onDoneRef.current?.();
          return;
        }
        setOpacity(1 - fadeProgress);
      }

      rafRef.current = requestAnimationFrame(draw);
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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        opacity,
        transition: 'opacity 100ms linear',
        backgroundColor: '#05060A',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
