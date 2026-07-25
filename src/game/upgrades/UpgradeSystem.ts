/**
 * UpgradeSystem — defines all available upgrades, applies them to the
 * player's modifiers, and generates a random 3-choice offering after each
 * cleared wave.
 */
import type { Player } from '@/game/player/Player';
import type { UpgradeChoice } from '@/game/types';
import { pick } from '@/game/utils';
import { WEAPONS } from '@/game/player/Weapon';

export interface UpgradeDef extends UpgradeChoice {
  apply: (player: Player) => void;
  weight: number;
  when?: (player: Player) => boolean;
}

const COMMON = 'common' as const;
const RARE = 'rare' as const;
const EPIC = 'epic' as const;

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'dmg_up',
    name: 'Sharpened Edge',
    description: '+15% melee damage',
    rarity: COMMON,
    icon: 'Sword',
    weight: 10,
    apply: (p) => (p.modifiers.damageMult *= 1.15),
  },
  {
    id: 'spd_up',
    name: 'Adrenaline',
    description: '+12% attack speed',
    rarity: COMMON,
    icon: 'Zap',
    weight: 9,
    apply: (p) => (p.modifiers.attackSpeedMult *= 1.12),
  },
  {
    id: 'hp_up',
    name: 'Thick Skin',
    description: '+25 max health (and heal)',
    rarity: COMMON,
    icon: 'Heart',
    weight: 10,
    apply: (p) => {
      p.modifiers.maxHealth += 25;
      p.applyModifiers();
      p.heal(25);
    },
  },
  {
    id: 'stam_up',
    name: 'Second Wind',
    description: '+25 max stamina',
    rarity: COMMON,
    icon: 'BatteryCharging',
    weight: 9,
    apply: (p) => {
      p.modifiers.maxStamina += 25;
      p.applyModifiers();
      p.stamina = p.maxStamina;
    },
  },
  {
    id: 'move_up',
    name: 'Fleet Footed',
    description: '+10% move speed',
    rarity: COMMON,
    icon: 'Footprints',
    weight: 8,
    apply: (p) => (p.modifiers.moveSpeedMult *= 1.1),
  },
  {
    id: 'sprint_eff',
    name: 'Efficient Lungs',
    description: '-25% sprint stamina cost',
    rarity: COMMON,
    icon: 'Wind',
    weight: 7,
    apply: (p) => (p.modifiers.sprintCostMult *= 0.75),
  },
  {
    id: 'dodge_cd',
    name: 'Slippery',
    description: '-25% dodge cooldown',
    rarity: RARE,
    icon: 'Shuffle',
    weight: 5,
    apply: (p) => (p.modifiers.dodgeCooldownMult *= 0.75),
  },
  {
    id: 'regen',
    name: 'Mending Flesh',
    description: 'Regen 3 HP/sec after 6s without damage',
    rarity: RARE,
    icon: 'Activity',
    weight: 5,
    apply: (p) => {
      p.modifiers.healthRegen = Math.max(p.modifiers.healthRegen, 3);
    },
  },
  {
    id: 'lifesteal',
    name: 'Bloodthirst',
    description: 'Heal for 10% of damage dealt',
    rarity: RARE,
    icon: 'Droplet',
    weight: 4,
    apply: (p) => (p.modifiers.lifesteal += 0.1),
  },
  {
    id: 'weapon_machete',
    name: 'Serrated Machete',
    description: 'Upgrade weapon: more damage & range',
    rarity: RARE,
    icon: 'Axe',
    weight: 4,
    apply: (p) => {
      if (p.weapon.def.id === 'glaive' || p.weapon.def.id === 'maul') return;
      p.weapon.switchTo('machete');
    },
  },
  {
    id: 'weapon_glaive',
    name: 'Abyssal Glaive',
    description: 'Legendary polearm: massive damage & reach',
    rarity: EPIC,
    icon: 'Sword',
    weight: 2,
    apply: (p) => p.weapon.switchTo('glaive'),
  },
  {
    id: 'weapon_maul',
    name: 'War Maul',
    description: 'Heavy hammer: huge damage & knockback, slow',
    rarity: EPIC,
    icon: 'Hammer',
    weight: 2,
    apply: (p) => p.weapon.switchTo('maul'),
  },
  {
    id: 'weapon_blade',
    name: 'Tempest Blade',
    description: 'Cursed blade: fast, wide arcs, high damage',
    rarity: EPIC,
    icon: 'Sword',
    weight: 2,
    apply: (p) => p.weapon.switchTo('blade'),
    when: (p) => p.weapon.def.id !== 'glaive',
  },
  {
    id: 'fury',
    name: 'Berserker Fury',
    description: '+30% damage, -10% max health',
    rarity: EPIC,
    icon: 'Flame',
    weight: 3,
    apply: (p) => {
      p.modifiers.damageMult *= 1.3;
      p.modifiers.maxHealth = Math.max(40, p.modifiers.maxHealth - 10);
      p.applyModifiers();
    },
  },
  {
    id: 'vitality',
    name: 'Unnatural Vigor',
    description: '+50 max health, +5 HP/sec regen',
    rarity: EPIC,
    icon: 'ShieldPlus',
    weight: 2,
    apply: (p) => {
      p.modifiers.maxHealth += 50;
      p.modifiers.healthRegen = Math.max(p.modifiers.healthRegen, 5);
      p.applyModifiers();
      p.heal(50);
    },
  },
];

export class UpgradeSystem {
  constructor(private player: Player) {}

  /** Pick 3 distinct upgrades, weighted by rarity. */
  rollChoices(count = 3): UpgradeDef[] {
    const pool = UPGRADES.filter((u) => !u.when || u.when(this.player));
    const chosen: UpgradeDef[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const totalWeight = pool.reduce((s, u) => s + u.weight, 0);
      let r = Math.random() * totalWeight;
      let idx = 0;
      for (let j = 0; j < pool.length; j++) {
        r -= pool[j].weight;
        if (r <= 0) {
          idx = j;
          break;
        }
      }
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return chosen;
  }

  apply(player: Player, upgrade: UpgradeDef): void {
    upgrade.apply(player);
  }
}

export { WEAPONS };
