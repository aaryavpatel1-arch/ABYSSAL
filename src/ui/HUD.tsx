/**
 * HUD — in-game heads-up display. Pure presentational; reads from the
 * game state store. Bars, crosshair, hit marker, combo, boss bar, banners,
 * and vignette overlays.
 */
import { Shield, Skull, Crosshair as CrosshairIcon, Coins, Zap, Battery, KeyRound, Layers, BookOpen } from 'lucide-react';
import { useGameState } from '@/game/GameState';

function StatBar({
  value,
  max,
  kind,
}: {
  value: number;
  max: number;
  kind: 'health' | 'stamina';
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="stat-bar" style={{ width: 200 }}>
      <div className={`stat-bar-fill ${kind}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function HUD() {
  const { hud, settings, fps } = useGameState();

  return (
    <>
      {/* Crosshair + hit marker */}
      <div className="crosshair" />
      {hud.hitMarker > 0.05 && (
        <div
          className="hitmarker"
          style={{ opacity: hud.hitMarker, transform: `translate(-50%, -50%) rotate(45deg) scale(${1 + hud.hitMarker * 0.3})` }}
        />
      )}

      {/* Vignettes */}
      <div className="vignette" />
      <div className="grain" />
      <div className="damage-vignette" style={{ opacity: hud.damageFlash }} />
      <div className="heal-vignette" style={{ opacity: hud.healFlash }} />
      <div className="parry-flash" style={{ opacity: hud.parryFlash }} />

      {/* Low-health red pulse handled via damage vignette already */}

      {/* Bottom-left: health & stamina */}
      <div className="hud-corner" style={{ left: 24, bottom: 24 }}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-red-500" />
            <StatBar value={hud.health} max={hud.maxHealth} kind="health" />
            <span className="font-body text-sm tabular-nums" style={{ color: '#e8d5d5', minWidth: 56 }}>
              {Math.ceil(hud.health)}/{hud.maxHealth}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-blue-400" />
            <StatBar value={hud.stamina} max={hud.maxStamina} kind="stamina" />
            <span className="font-body text-sm tabular-nums" style={{ color: '#cbd5e1', minWidth: 56 }}>
              {Math.ceil(hud.stamina)}/{hud.maxStamina}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom-right: weapon + controls hint */}
      <div className="hud-corner" style={{ right: 24, bottom: 24, textAlign: 'right' }}>
        <div className="font-display text-sm" style={{ color: '#e8d5d5', letterSpacing: '0.15em' }}>
          {hud.weaponName}
        </div>
        <div className="font-body text-xs mt-1" style={{ color: 'rgba(200,200,200,0.5)', letterSpacing: '0.1em' }}>
          LMB ATTACK · RMB PARRY · SPACE DODGE · F LIGHT
        </div>
      </div>

      {/* Top-left: level + enemies */}
      <div className="hud-corner" style={{ left: 24, top: 24 }}>
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-amber-500" />
          <span className="font-display text-xl" style={{ color: '#e8d5d5' }}>
            {hud.isBossLevel ? 'BOSS ARENA' : `LEVEL ${hud.level}`}
          </span>
        </div>
        <div className="font-body text-sm mt-1" style={{ color: 'rgba(220,180,180,0.8)' }}>
          Remaining: <span className="tabular-nums font-semibold text-red-400">{hud.enemiesRemaining}</span>
        </div>
        {hud.hasKeycard && !hud.isBossLevel && (
          <div className="flex items-center gap-1 mt-1 font-body text-xs" style={{ color: 'rgba(234,179,8,0.9)' }}>
            <KeyRound size={12} /> KEYCARD ACQUIRED
          </div>
        )}
      </div>

      {/* Top-right: score, kills, currency */}
      <div className="hud-corner" style={{ right: 24, top: 24, textAlign: 'right' }}>
        <div className="font-display text-lg" style={{ color: '#e8d5d5' }}>
          {hud.score.toLocaleString()}
        </div>
        <div className="font-body text-xs mt-1 flex items-center justify-end gap-3" style={{ color: 'rgba(200,200,200,0.7)' }}>
          <span>KILLS {hud.kills}</span>
          <span className="flex items-center gap-1">
            <Coins size={12} className="text-amber-500" /> {hud.currency}
          </span>
        </div>
        {settings.showFps && (
          <div className="font-body text-xs mt-1" style={{ color: 'rgba(120,200,120,0.7)' }}>
            {Math.round(fps)} FPS
          </div>
        )}
      </div>

      {/* Battery meter (top-left, below level) */}
      <div className="hud-corner" style={{ left: 24, top: 92 }}>
        <div className="flex items-center gap-2">
          <Battery size={14} style={{ color: hud.flashlightBattery < 25 ? '#ef4444' : '#facc15' }} />
          <div className="stat-bar" style={{ width: 100, height: 8 }}>
            <div
              className="stat-bar-fill"
              style={{
                width: `${hud.flashlightBattery}%`,
                background: hud.flashlightBattery < 25 ? '#ef4444' : '#facc15',
              }}
            />
          </div>
        </div>
        {hud.codexCount > 0 && (
          <div className="flex items-center gap-1 mt-1 font-body text-[10px]" style={{ color: 'rgba(167,139,250,0.7)' }}>
            <BookOpen size={10} /> {hud.codexCount}/{hud.codexTotal} CODEX
          </div>
        )}
      </div>

      {/* Combo counter (center-top) */}
      {hud.comboCount > 1 && (
        <div
          className="hud-corner"
          style={{ left: '50%', top: 80, transform: 'translateX(-50%)' }}
        >
          <div className="text-center">
            <div
              className="font-display font-black"
              style={{
                fontSize: '2.4rem',
                color: '#ea580c',
                textShadow: '0 0 20px rgba(234,88,12,0.7)',
                lineHeight: 1,
              }}
            >
              {hud.comboCount}
            </div>
            <div className="font-body text-xs" style={{ color: 'rgba(234,88,12,0.8)', letterSpacing: '0.3em' }}>
              COMBO
            </div>
            <div className="mt-1 mx-auto" style={{ width: 80, height: 3, background: 'rgba(80,30,10,0.6)' }}>
              <div style={{ width: `${hud.comboTimer * 100}%`, height: '100%', background: '#ea580c' }} />
            </div>
          </div>
        </div>
      )}

      {/* Style meter (right of combo) */}
      {hud.styleRating && (
        <div
          className="hud-corner"
          style={{ left: '50%', top: 80, transform: 'translateX(60px)' }}
        >
          <div className="text-center">
            <div
              className="font-display font-black"
              style={{
                fontSize: '1.6rem',
                color: styleColor(hud.styleRating),
                textShadow: `0 0 16px ${styleColor(hud.styleRating)}99`,
                lineHeight: 1,
              }}
            >
              {hud.styleRating}
            </div>
            <div className="font-body text-[10px]" style={{ color: styleColor(hud.styleRating), letterSpacing: '0.2em' }}>
              STYLE
            </div>
            <div className="mt-1 mx-auto" style={{ width: 60, height: 2, background: 'rgba(40,40,50,0.6)' }}>
              <div style={{ width: `${hud.styleMeter * 100}%`, height: '100%', background: styleColor(hud.styleRating) }} />
            </div>
          </div>
        </div>
      )}

      {/* Jumpscare flash overlay */}
      {hud.jumpscareFlash > 0.05 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 8,
            background: 'rgba(20,0,0,0.7)',
            opacity: hud.jumpscareFlash,
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {/* Parry / dodge cooldown indicators (center-bottom) */}
      <div className="hud-corner" style={{ left: '50%', bottom: 24, transform: 'translateX(-50%)' }}>
        <div className="flex gap-3 items-center">
          <CooldownPip
            label="PARRY"
            ready={hud.parryReady}
            frac={hud.parryCooldown}
            color="#eab308"
          />
          <CooldownPip
            label="DODGE"
            ready={hud.dodgeReady}
            frac={hud.dodgeCooldown}
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Boss bar (top-center) */}
      {hud.bossActive && (
        <div
          className="hud-corner"
          style={{ left: '50%', top: 20, transform: 'translateX(-50%)', width: 'min(620px, 80vw)' }}
        >
          <div className="text-center mb-1">
            <span className="font-display text-sm" style={{ color: '#fca5a5', letterSpacing: '0.3em' }}>
              {hud.bossName.toUpperCase()}
            </span>
          </div>
          <div className="stat-bar" style={{ height: 10, width: '100%', clipPath: 'none' }}>
            <div
              className="stat-bar-fill boss"
              style={{ width: `${Math.max(0, (hud.bossHealth / hud.bossMaxHealth) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Wave banner */}
      {hud.waveBanner && (
        <div className="wave-banner">
          <div className="banner-title">{hud.waveBanner}</div>
          {hud.bannerSubtext && <div className="banner-sub">{hud.bannerSubtext}</div>}
        </div>
      )}
    </>
  );
}

function styleColor(rating: string): string {
  switch (rating) {
    case 'C': return '#888';
    case 'B': return '#3b82f6';
    case 'A': return '#22c55e';
    case 'S': return '#ea580c';
    case 'ULTRA': return '#ef4444';
    default: return '#888';
  }
}

function CooldownPip({
  label,
  ready,
  frac,
  color,
}: {
  label: string;
  ready: boolean;
  frac: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 4,
          border: `1px solid ${ready ? color : 'rgba(100,100,100,0.4)'}`,
          background: ready ? `${color}22` : 'rgba(10,10,12,0.7)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: ready ? `0 0 12px ${color}55` : 'none',
          transition: 'all 0.2s',
        }}
      >
        {!ready && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${frac * 100}%`,
              background: `${color}33`,
            }}
          />
        )}
        {ready && (
          <div
            className="pulse-dot"
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: color }}
          />
        )}
      </div>
      <span className="font-body text-[10px]" style={{ color: ready ? color : 'rgba(150,150,150,0.6)', letterSpacing: '0.15em' }}>
        {label}
      </span>
    </div>
  );
}
