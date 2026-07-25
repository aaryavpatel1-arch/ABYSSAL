/**
 * UpgradeScreen — shows 3 boon choices after each cleared wave.
 * Clicking a card applies the upgrade and continues to the next wave.
 */
import * as Icons from 'lucide-react';
import type { ComponentType } from 'react';
import { useGameState } from '@/game/GameState';

interface Props {
  onSelect: (id: string) => void;
}

const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
};

const RARITY_COLOR: Record<string, string> = {
  common: '#888',
  rare: '#3b82f6',
  epic: '#ea580c',
};

export function UpgradeScreen({ onSelect }: Props) {
  const { upgradeChoices, hud } = useGameState();

  return (
    <div className="menu-backdrop fade-in">
      <div className="text-center mb-2">
        <h2 className="font-display text-3xl" style={{ color: '#e8d5d5', letterSpacing: '0.25em' }}>
          CHOOSE YOUR BOON
        </h2>
        <p className="font-body text-sm mt-2" style={{ color: 'rgba(234,88,12,0.8)', letterSpacing: '0.3em' }}>
          WAVE {hud.wave} CLEARED
        </p>
      </div>

      <div className="flex gap-6 mt-10 flex-wrap justify-center px-4">
        {upgradeChoices.map((choice, i) => {
          const IconComp = (Icons as unknown as Record<string, ComponentType<{ size?: number; className?: string }>>)[
            choice.icon
          ] ?? Icons.Sparkles;
          return (
            <div
              key={choice.id}
              className={`upgrade-card rarity-${choice.rarity} slide-up`}
              style={{ animationDelay: `${i * 0.1}s` }}
              onClick={() => onSelect(choice.id)}
            >
              <div
                className="font-body text-[10px] mb-4"
                style={{ color: RARITY_COLOR[choice.rarity], letterSpacing: '0.3em' }}
              >
                {RARITY_LABEL[choice.rarity]}
              </div>
              <div
                className="mb-4"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${RARITY_COLOR[choice.rarity]}15`,
                  border: `1px solid ${RARITY_COLOR[choice.rarity]}44`,
                  boxShadow: `0 0 24px ${RARITY_COLOR[choice.rarity]}33`,
                }}
              >
                <IconComp size={30} className="" />
                <span style={{ display: 'none' }}>{choice.icon}</span>
              </div>
              <h3
                className="font-display text-lg mb-3"
                style={{ color: '#e8d5d5', letterSpacing: '0.1em', lineHeight: 1.2 }}
              >
                {choice.name}
              </h3>
              <p className="font-body text-sm" style={{ color: '#b0b0b0', lineHeight: 1.5 }}>
                {choice.description}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-10 font-body text-xs" style={{ color: 'rgba(160,160,160,0.45)', letterSpacing: '0.2em' }}>
        EACH BOON ALSO HEALS YOU 15 HP
      </p>
    </div>
  );
}
