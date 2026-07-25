/**
 * StoryModal — shows when the player inspects a collectible (audio log,
 * terminal, note) inside a maze. Displays the lore text, then closes.
 */
import { Volume2, Terminal, ScrollText } from 'lucide-react';
import { useGameState } from '@/game/GameState';

interface Props {
  onClose: () => void;
}

const TYPE_META: Record<string, { label: string; icon: typeof Volume2; color: string }> = {
  audio_log: { label: 'AUDIO LOG', icon: Volume2, color: '#3b82f6' },
  terminal: { label: 'TERMINAL', icon: Terminal, color: '#ea580c' },
  note: { label: 'NOTE', icon: ScrollText, color: '#888' },
};

export function StoryModal({ onClose }: Props) {
  const { activeStoryEntry } = useGameState();
  if (!activeStoryEntry) return null;
  const meta = TYPE_META[activeStoryEntry.type] ?? TYPE_META.note;
  const Icon = meta.icon;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', zIndex: 45, pointerEvents: 'auto' }}
      onClick={onClose}
    >
      <div
        className="slide-up"
        style={{
          maxWidth: 560,
          background: 'linear-gradient(180deg, rgba(18,14,22,0.98), rgba(10,8,14,0.99))',
          border: `1px solid ${meta.color}55`,
          padding: '2rem 2.5rem',
          clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
          boxShadow: `0 0 32px ${meta.color}22`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon size={18} style={{ color: meta.color }} />
          <span
            className="font-body text-xs"
            style={{ color: meta.color, letterSpacing: '0.3em' }}
          >
            {meta.label} — RECOVERED
          </span>
        </div>
        <h3
          className="font-display text-xl mb-4"
          style={{ color: '#e8d5d5', letterSpacing: '0.1em', lineHeight: 1.3 }}
        >
          {activeStoryEntry.title}
        </h3>
        <p
          className="font-body"
          style={{ color: '#c0c0c0', lineHeight: 1.7, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}
        >
          {activeStoryEntry.text}
        </p>
        <button
          onClick={onClose}
          className="btn-horror mt-6"
          style={{ fontSize: '0.8rem' }}
        >
          <span className="flex items-center gap-2">CONTINUE</span>
        </button>
      </div>
    </div>
  );
}
