/**
 * SettingsScreen — audio, look, and display options. Reads/writes the
 * shared Settings via the game instance callback.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Settings } from '@/game/types';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  inGame?: boolean;
}

export function SettingsScreen({ settings, onChange, onBack, inGame }: Props) {
  const [local, setLocal] = useState<Settings>(settings);

  const update = (patch: Partial<Settings>): void => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="menu-backdrop fade-in">
      <div
        className="slide-up w-full max-w-xl px-8"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 font-body text-sm"
            style={{ color: '#888', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="font-display text-2xl" style={{ color: '#e8d5d5', letterSpacing: '0.2em' }}>
            SETTINGS
          </h2>
        </div>

        <section className="mb-6">
          <h3 className="font-display text-sm mb-3" style={{ color: '#ea580c', letterSpacing: '0.2em' }}>
            AUDIO
          </h3>
          <Slider label="Master Volume" value={local.masterVolume} min={0} max={1} step={0.05} onChange={(v) => update({ masterVolume: v })} />
          <Slider label="SFX Volume" value={local.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => update({ sfxVolume: v })} />
          <Slider label="Music / Ambience" value={local.musicVolume} min={0} max={1} step={0.05} onChange={(v) => update({ musicVolume: v })} />
        </section>

        <section className="mb-6">
          <h3 className="font-display text-sm mb-3" style={{ color: '#ea580c', letterSpacing: '0.2em' }}>
            LOOK
          </h3>
          <Slider label="Sensitivity" value={local.sensitivity} min={0.1} max={3} step={0.05} onChange={(v) => update({ sensitivity: v })} format={(v) => v.toFixed(2)} />
          <Toggle label="Invert Y Axis" value={local.invertY} onChange={(v) => update({ invertY: v })} />
        </section>

        <section className="mb-6">
          <h3 className="font-display text-sm mb-3" style={{ color: '#ea580c', letterSpacing: '0.2em' }}>
            DISPLAY
          </h3>
          <Slider label="Field of View" value={local.fov} min={70} max={100} step={1} onChange={(v) => update({ fov: v })} format={(v) => `${v}°`} />
          <Toggle label="Show FPS Counter" value={local.showFps} onChange={(v) => update({ showFps: v })} />
        </section>

        {inGame && (
          <div className="mt-8 font-body text-xs" style={{ color: 'rgba(160,160,160,0.5)' }}>
            Changes apply immediately.
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider-row">
      <label>{label}</label>
      <input
        type="range"
        className="horror-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="font-body text-sm tabular-nums" style={{ color: '#c0c0c0', minWidth: 48 }}>
        {format ? format(value) : Math.round(value * 100) + '%'}
      </span>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="slider-row">
      <label>{label}</label>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 48,
          height: 24,
          borderRadius: 12,
          background: value ? 'rgba(234,88,12,0.4)' : 'rgba(40,40,45,0.6)',
          border: `1px solid ${value ? 'rgba(234,88,12,0.7)' : 'rgba(100,100,100,0.3)'}`,
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 26 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: value ? '#ea580c' : '#666',
            transition: 'all 0.2s',
            boxShadow: value ? '0 0 8px rgba(234,88,12,0.6)' : 'none',
          }}
        />
      </button>
    </div>
  );
}
