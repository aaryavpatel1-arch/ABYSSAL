/**
 * Cutscene — the opening cinematic when the player starts a new run.
 *
 * A multi-beat stylized sequence rendered on a 2D canvas overlay:
 *   1. The submersible descending into the trench (animated particles +
 *      depth counter).
 *   2. Emergency power failure (screen flicker, red warning, rumble).
 *   3. Crash-landing into The Abyssal facility (impact flash).
 *
 * Includes a "Skip Cutscene" button. Uses heavy ambient drone + stingers
 * from the AudioManager via callbacks.
 */
import { useEffect, useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';

interface Props {
  onFinish: () => void;
}

interface Particle {
  x: number;
  y: number;
  vy: number;
  size: number;
  opacity: number;
}

type Beat = 'descend' | 'failure' | 'crash' | 'arrive';

const BEAT_TIMINGS: { beat: Beat; label: string; sub: string; duration: number }[] = [
  { beat: 'descend', label: 'DEPTH 0M', sub: 'INITIATING DESCENT', duration: 5 },
  { beat: 'failure', label: 'WARNING', sub: 'REACTOR CONTAINMENT LOST', duration: 3.5 },
  { beat: 'crash', label: 'IMPACT', sub: 'HULL BREACH — SECTOR UNKNOWN', duration: 3 },
  { beat: 'arrive', label: 'THE ABYSSAL', sub: 'YOU ARE INSIDE', duration: 3.5 },
];

export function Cutscene({ onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [depth, setDepth] = useState(0);
  const [flicker, setFlicker] = useState(false);
  const [rumble, setRumble] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const beatStartRef = useRef(performance.now());

  // Beat progression
  useEffect(() => {
    if (skipped) return;
    const current = BEAT_TIMINGS[beatIndex];
    const timer = setTimeout(() => {
      if (beatIndex < BEAT_TIMINGS.length - 1) {
        setBeatIndex((b) => b + 1);
        beatStartRef.current = performance.now();
      } else {
        onFinish();
      }
    }, current.duration * 1000);
    return () => clearTimeout(timer);
  }, [beatIndex, skipped, onFinish]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const particles: Particle[] = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vy: 0.3 + Math.random() * 1.5,
        size: 1 + Math.random() * 3,
        opacity: 0.1 + Math.random() * 0.5,
      });
    }

    let lastDepth = 0;
    let frame = 0;

    const draw = (): void => {
      if (skipped) return;
      raf = requestAnimationFrame(draw);
      frame++;
      const w = canvas.width;
      const h = canvas.height;
      const beat = BEAT_TIMINGS[beatIndex];

      // Background gradient — deep ocean
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (beat.beat === 'descend') {
        grad.addColorStop(0, '#021016');
        grad.addColorStop(0.5, '#010a10');
        grad.addColorStop(1, '#000406');
      } else if (beat.beat === 'failure') {
        const flick = Math.sin(frame * 0.8) > 0.7 ? 0.6 : 0.1;
        grad.addColorStop(0, `rgba(${20 + flick * 80},5,5,1)`);
        grad.addColorStop(1, '#0a0202');
      } else if (beat.beat === 'crash') {
        const flash = frame % 20 < 3 ? 0.9 : 0.05;
        grad.addColorStop(0, `rgba(${10 + flash * 200},5,5,1)`);
        grad.addColorStop(1, '#000');
      } else {
        grad.addColorStop(0, '#0a0205');
        grad.addColorStop(0.5, '#050102');
        grad.addColorStop(1, '#000');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Descending particles (bubbles / debris)
      for (const p of particles) {
        p.y += p.vy;
        if (p.y > h) {
          p.y = -10;
          p.x = Math.random() * w;
        }
        ctx.fillStyle = beat.beat === 'failure' || beat.beat === 'crash'
          ? `rgba(180,40,40,${p.opacity})`
          : `rgba(80,140,180,${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Submersible silhouette (center) — bobs and descends
      const subY = h / 2 + Math.sin(frame * 0.03) * 8;
      const subScale = beat.beat === 'crash' ? 1 + (frame % 10) * 0.05 : 1;
      ctx.save();
      ctx.translate(w / 2, subY);
      ctx.scale(subScale, subScale);
      // Hull
      ctx.fillStyle = beat.beat === 'failure' || beat.beat === 'crash' ? '#2a1010' : '#101820';
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Porthole glow
      ctx.fillStyle = beat.beat === 'failure' || beat.beat === 'crash' ? '#ff4422' : '#44aaff';
      ctx.beginPath();
      ctx.arc(0, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      // Tether line upward
      ctx.strokeStyle = 'rgba(60,80,100,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(0, -h / 2);
      ctx.stroke();
      ctx.restore();

      // Depth lines (horizon tick marks)
      if (beat.beat === 'descend') {
        ctx.strokeStyle = 'rgba(40,60,80,0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const y = ((frame * 2 + i * h / 5) % h);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }

      // Vignette
      const vgrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
      vgrad.addColorStop(0, 'rgba(0,0,0,0)');
      vgrad.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vgrad;
      ctx.fillRect(0, 0, w, h);
    };

    // Resize handler
    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [beatIndex, skipped]);

  // Depth counter + flicker/rumble effects
  useEffect(() => {
    if (skipped) return;
    let raf = 0;
    let frame = 0;
    let depthVal = 0;
    const frameTick = (): void => {
      raf = requestAnimationFrame(frameTick);
      frame++;
      const beat = BEAT_TIMINGS[beatIndex];
      if (beat.beat === 'descend') {
        depthVal += 8;
        setDepth(depthVal);
      } else if (beat.beat === 'failure') {
        setFlicker(Math.random() < 0.4);
        setRumble(true);
      } else if (beat.beat === 'crash') {
        setFlicker(frame % 15 < 4);
      } else {
        setRumble(false);
        setFlicker(false);
      }
    };
    frameTick();
    return () => cancelAnimationFrame(raf);
  }, [beatIndex, skipped]);

  const handleSkip = (): void => {
    setSkipped(true);
    onFinish();
  };

  const currentBeat = BEAT_TIMINGS[beatIndex];
  const isWarning = currentBeat.beat === 'failure' || currentBeat.beat === 'crash';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        overflow: 'hidden',
        background: '#000',
        transform: rumble ? `translate(${(Math.random() - 0.5) * 6}px, ${(Math.random() - 0.5) * 6}px)` : 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: flicker ? 0.3 : 1, transition: 'opacity 0.05s' }}
      />

      {/* Text overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          key={beatIndex}
          className="fade-in"
          style={{
            fontFamily: 'Cinzel, serif',
            fontSize: 'clamp(2rem, 6vw, 4rem)',
            fontWeight: 900,
            letterSpacing: '0.3em',
            color: isWarning ? '#ff3b3b' : '#c8d8e8',
            textShadow: isWarning
              ? '0 0 30px rgba(255,40,40,0.6), 0 0 8px rgba(0,0,0,0.9)'
              : '0 0 24px rgba(80,140,200,0.4), 0 4px 12px rgba(0,0,0,0.9)',
            opacity: flicker ? 0.4 : 1,
            transition: 'opacity 0.05s',
          }}
        >
          {currentBeat.label}
        </div>
        <div
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: isWarning ? 'rgba(255,80,80,0.8)' : 'rgba(120,180,220,0.7)',
            fontSize: '0.9rem',
            marginTop: '1rem',
          }}
        >
          {currentBeat.sub}
        </div>
        {currentBeat.beat === 'descend' && (
          <div
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontSize: '1.1rem',
              color: 'rgba(100,160,200,0.6)',
              marginTop: '2rem',
              letterSpacing: '0.2em',
            }}
          >
            {depth.toLocaleString()}M
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(400px, 70vw)',
          height: 2,
          background: 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${((beatIndex + 1) / BEAT_TIMINGS.length) * 100}%`,
            background: isWarning ? '#ff3b3b' : '#44aaff',
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          padding: '0.6rem 1.4rem',
          background: 'rgba(20,20,25,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(220,220,230,0.8)',
          fontFamily: 'Rajdhani, sans-serif',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(40,40,50,0.9)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(20,20,25,0.7)')}
      >
        <SkipForward size={14} /> Skip Cutscene
      </button>
    </div>
  );
}
