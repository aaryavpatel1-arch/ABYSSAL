/**
 * PauseMenu — shown when the game is paused (Esc or pointer-unlock).
 */
import { Play, Settings as SettingsIcon, Home, RotateCcw } from 'lucide-react';

interface Props {
  onResume: () => void;
  onSettings: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseMenu({ onResume, onSettings, onRestart, onQuit }: Props) {
  return (
    <div className="menu-backdrop fade-in">
      <h2 className="font-display text-4xl mb-10" style={{ color: '#e8d5d5', letterSpacing: '0.3em' }}>
        PAUSED
      </h2>
      <div className="flex flex-col gap-4 items-center">
        <button className="btn-horror primary slide-up" onClick={onResume}>
          <span className="flex items-center gap-3">
            <Play size={16} /> Resume
          </span>
        </button>
        <button className="btn-horror slide-up" onClick={onSettings} style={{ animationDelay: '0.1s' }}>
          <span className="flex items-center gap-3">
            <SettingsIcon size={16} /> Settings
          </span>
        </button>
        <button className="btn-horror slide-up" onClick={onRestart} style={{ animationDelay: '0.2s' }}>
          <span className="flex items-center gap-3">
            <RotateCcw size={16} /> Restart Run
          </span>
        </button>
        <button className="btn-horror slide-up" onClick={onQuit} style={{ animationDelay: '0.3s' }}>
          <span className="flex items-center gap-3">
            <Home size={16} /> Quit to Menu
          </span>
        </button>
      </div>
    </div>
  );
}
