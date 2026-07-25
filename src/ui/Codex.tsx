/**
 * Codex — in-game Journal showing collected lore entries (audio logs,
 * terminals, notes). Accessed from the pause menu or a dedicated tab.
 */
import { useState } from 'react';
import { BookOpen, X, Volume2, Terminal, ScrollText, Lock } from 'lucide-react';
import { useGameState } from '@/game/GameState';

interface Props {
  onClose: () => void;
}

const TYPE_META: Record<string, { label: string; icon: typeof Volume2; color: string }> = {
  audio_log: { label: 'AUDIO LOG', icon: Volume2, color: '#3b82f6' },
  terminal: { label: 'TERMINAL', icon: Terminal, color: '#ea580c' },
  note: { label: 'NOTE', icon: ScrollText, color: '#888' },
};

export function Codex({ onClose }: Props) {
  const { codexEntries } = useGameState();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = codexEntries.find((c) => c.entry.id === selectedId);
  const collectedCount = codexEntries.filter((c) => c.collected).length;

  return (
    <div
      className="menu-backdrop fade-in"
      style={{ zIndex: 40 }}
    >
      <div
        className="slide-up"
        style={{
          width: 'min(900px, 92vw)',
          maxHeight: '88vh',
          background: 'linear-gradient(180deg, rgba(15,12,18,0.98), rgba(8,6,12,0.99))',
          border: '1px solid rgba(120,80,160,0.3)',
          display: 'flex',
          flexDirection: 'column',
          clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(100,80,140,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <BookOpen size={22} style={{ color: '#a78bfa' }} />
            <h2
              className="font-display text-2xl"
              style={{ color: '#e8d5d5', letterSpacing: '0.2em' }}
            >
              CODEX
            </h2>
            <span
              className="font-body text-xs"
              style={{ color: 'rgba(167,139,250,0.6)', letterSpacing: '0.2em' }}
            >
              {collectedCount} / {codexEntries.length} RECOVERED
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#888', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body: list + detail */}
        <div className="flex" style={{ flex: 1, minHeight: 0 }}>
          {/* Entry list */}
          <div
            style={{
              width: 280,
              overflowY: 'auto',
              borderRight: '1px solid rgba(80,60,120,0.2)',
              padding: '0.5rem',
            }}
          >
            {codexEntries.map((c) => {
              const meta = TYPE_META[c.entry.type];
              const Icon = c.collected ? meta.icon : Lock;
              const isSel = c.entry.id === selectedId;
              return (
                <div
                  key={c.entry.id}
                  onClick={() => setSelectedId(c.entry.id)}
                  style={{
                    padding: '0.7rem 0.8rem',
                    marginBottom: 4,
                    cursor: 'pointer',
                    background: isSel ? 'rgba(120,80,160,0.15)' : 'transparent',
                    border: isSel ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.15s',
                    opacity: c.collected ? 1 : 0.45,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) e.currentTarget.style.background = 'rgba(80,60,120,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon size={16} style={{ color: c.collected ? meta.color : '#555' }} />
                  <span
                    className="font-body text-sm"
                    style={{ color: c.collected ? '#d0d0d0' : '#666' }}
                  >
                    {c.collected ? c.entry.title : '??? UNKNOWN ENTRY'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
            {!selected && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(150,150,160,0.4)',
                }}
              >
                <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                <span className="font-body text-sm" style={{ letterSpacing: '0.2em' }}>
                  SELECT AN ENTRY TO READ
                </span>
              </div>
            )}
            {selected && !selected.collected && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(150,150,160,0.4)',
                }}
              >
                <Lock size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                <span className="font-body text-sm" style={{ letterSpacing: '0.2em' }}>
                  NOT YET RECOVERED
                </span>
              </div>
            )}
            {selected && selected.collected && (
              <div className="fade-in">
                {(() => {
                  const meta = TYPE_META[selected.entry.type];
                  const Icon = meta.icon;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon size={18} style={{ color: meta.color }} />
                        <span
                          className="font-body text-xs"
                          style={{ color: meta.color, letterSpacing: '0.3em' }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <h3
                        className="font-display text-xl mb-4"
                        style={{ color: '#e8d5d5', letterSpacing: '0.1em', lineHeight: 1.3 }}
                      >
                        {selected.entry.title}
                      </h3>
                      <p
                        className="font-body"
                        style={{
                          color: '#c0c0c0',
                          lineHeight: 1.7,
                          fontSize: '0.95rem',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {selected.entry.text}
                      </p>
                      <div
                        className="mt-6 pt-4 font-body text-xs"
                        style={{
                          color: 'rgba(150,150,160,0.4)',
                          borderTop: '1px solid rgba(80,60,120,0.2)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        FOUND: LEVELS {selected.entry.minLevel}–{selected.entry.maxLevel}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
