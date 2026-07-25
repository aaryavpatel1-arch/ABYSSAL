/**
 * MainMenu — title screen with Start, Settings, and How-to-Play.
 */
import { useState } from 'react';
import { Play, Settings as SettingsIcon, BookOpen, X } from 'lucide-react';

interface Props {
  onStart: () => void;
  onOpenSettings: () => void;
}

export function MainMenu({ onStart, onOpenSettings }: Props) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="menu-backdrop fade-in">
      <div className="text-center mb-12">
        <div className="title-glitch">ABYSSAL</div>
        <div className="subtitle">Descend into The Abyssal</div>
      </div>

      <div className="flex flex-col gap-4 items-center">
        <button className="btn-horror primary slide-up" onClick={onStart} style={{ animationDelay: '0.1s' }}>
          <span className="flex items-center gap-3">
            <Play size={16} /> Start Game
          </span>
        </button>
        <button className="btn-horror slide-up" onClick={onOpenSettings} style={{ animationDelay: '0.2s' }}>
          <span className="flex items-center gap-3">
            <SettingsIcon size={16} /> Settings
          </span>
        </button>
        <button className="btn-horror slide-up" onClick={() => setShowHelp(true)} style={{ animationDelay: '0.3s' }}>
          <span className="flex items-center gap-3">
            <BookOpen size={16} /> How to Survive
          </span>
        </button>
      </div>

      <div className="absolute bottom-6 font-body text-xs" style={{ color: 'rgba(150,150,150,0.4)', letterSpacing: '0.2em' }}>
        DESCEND 50 LEVELS · UNCOVER THE TRUTH · SLAY THE WARDENS
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['WASD', 'Move'],
    ['MOUSE', 'Look around'],
    ['SHIFT', 'Sprint (drains stamina)'],
    ['SPACE', 'Jump / Dodge (tap while moving)'],
    ['LMB', 'Attack — chain hits for combos & style'],
    ['RMB', 'Parry — time it during enemy windup to stagger & damage'],
    ['F', 'Toggle flashlight (battery drains in the dark)'],
    ['E', 'Interact / inspect collectibles'],
    ['J', 'Open Codex / Journal (when paused)'],
    ['ESC', 'Pause'],
  ];
  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="slide-up"
        style={{
          background: 'linear-gradient(180deg, rgba(20,10,10,0.98), rgba(8,4,4,0.99))',
          border: '1px solid rgba(185,28,28,0.4)',
          padding: '2rem 2.5rem',
          maxWidth: 540,
          clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl" style={{ color: '#e8d5d5', letterSpacing: '0.15em' }}>
            HOW TO SURVIVE
          </h2>
          <button onClick={onClose} style={{ color: '#888', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {rows.map(([key, desc]) => (
            <div key={key} className="flex items-center gap-4">
              <span
                className="font-display text-sm"
                style={{
                  color: '#ea580c',
                  minWidth: 90,
                  letterSpacing: '0.1em',
                  background: 'rgba(234,88,12,0.08)',
                  padding: '2px 8px',
                  border: '1px solid rgba(234,88,12,0.2)',
                }}
              >
                {key}
              </span>
              <span className="font-body text-sm" style={{ color: '#c0c0c0' }}>
                {desc}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 font-body text-xs" style={{ color: 'rgba(180,180,180,0.6)', borderTop: '1px solid rgba(80,30,30,0.4)' }}>
          Parrying is your most powerful tool — it staggers enemies, deals heavy
          damage, and restores stamina. Dodge to escape combos. After each wave,
          choose a boon to grow stronger.
        </div>
      </div>
    </div>
  );
}
