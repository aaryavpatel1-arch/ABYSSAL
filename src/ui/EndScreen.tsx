/**
 * EndScreen — victory or death screen with run stats.
 */
import { RotateCcw, Home, Skull, Trophy } from 'lucide-react';
import { useGameState } from '@/game/GameState';

interface Props {
  onRestart: () => void;
  onMenu: () => void;
}

export function EndScreen({ onRestart, onMenu }: Props) {
  const { phase, lastRun } = useGameState();
  const victory = phase === 'victory';

  return (
    <div className="menu-backdrop fade-in">
      <div className="text-center mb-8">
        {victory ? (
          <>
            <Trophy size={56} className="mx-auto mb-4" style={{ color: '#ea580c' }} />
            <h2
              className="font-display font-black"
              style={{ fontSize: 'clamp(2rem,6vw,4rem)', color: '#e8d5d5', letterSpacing: '0.2em' }}
            >
              VICTORY
            </h2>
            <p className="font-body text-sm mt-2" style={{ color: 'rgba(234,88,12,0.8)', letterSpacing: '0.3em' }}>
              THE WARDEN HAS FALLEN
            </p>
          </>
        ) : (
          <>
            <Skull size={56} className="mx-auto mb-4" style={{ color: '#7f1d1d' }} />
            <h2
              className="font-display font-black"
              style={{ fontSize: 'clamp(2rem,6vw,4rem)', color: '#b91c1c', letterSpacing: '0.2em' }}
            >
              YOU DIED
            </h2>
            <p className="font-body text-sm mt-2" style={{ color: 'rgba(180,80,80,0.7)', letterSpacing: '0.3em' }}>
              THE ABYSS CLAIMS ANOTHER
            </p>
          </>
        )}
      </div>

      {lastRun && (
        <div
          className="slide-up mb-8"
          style={{
            background: 'rgba(15,8,8,0.8)',
            border: '1px solid rgba(120,30,30,0.3)',
            padding: '1.5rem 2.5rem',
            clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
          }}
        >
          <div className="grid grid-cols-3 gap-8 text-center">
            <Stat label="WAVE" value={lastRun.waveReached.toString()} />
            <Stat label="KILLS" value={lastRun.kills.toString()} />
            <Stat label="SCORE" value={lastRun.score.toLocaleString()} />
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <button className="btn-horror primary" onClick={onRestart}>
          <span className="flex items-center gap-3">
            <RotateCcw size={16} /> Try Again
          </span>
        </button>
        <button className="btn-horror" onClick={onMenu}>
          <span className="flex items-center gap-3">
            <Home size={16} /> Main Menu
          </span>
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-3xl" style={{ color: '#e8d5d5' }}>
        {value}
      </div>
      <div className="font-body text-xs mt-1" style={{ color: 'rgba(200,200,200,0.5)', letterSpacing: '0.25em' }}>
        {label}
      </div>
    </div>
  );
}
