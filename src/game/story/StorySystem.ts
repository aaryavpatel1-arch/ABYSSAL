/**
 * StorySystem — lore entries, collectible placement, and the Codex/Journal.
 *
 * Lore entries are scattered across maze dead-ends as collectibles
 * (audio logs, terminal screens, notes). When the player inspects one,
 * a story modal opens and the entry is logged in the Codex.
 */
import type { LoreEntry, CollectibleType, CodexEntry } from '@/game/types';
import { pick } from '@/game/utils';

export const LORE_ENTRIES: LoreEntry[] = [
  {
    id: 'log_01',
    title: 'Chief Engineer\'s Log — Descent',
    type: 'audio_log',
    text: '...day fourteen. The trench readings are off the charts. Dr. Vex says we\'re close to something down there — something the company never told us about. The submersible hull is groaning. I keep telling myself it\'s just pressure. But pressure doesn\'t whisper back.',
    minLevel: 1,
    maxLevel: 5,
  },
  {
    id: 'log_02',
    title: 'Power Failure Report',
    type: 'terminal',
    text: 'EMERGENCY: Main reactor lost containment at 04:12. Backup generators lasted eleven minutes. The Abyssal facility has gone dark. All personnel are instructed to — [SIGNAL LOST] — if anyone can hear this, do not descend past Sector 3.',
    minLevel: 1,
    maxLevel: 5,
  },
  {
    id: 'note_01',
    title: 'Scrawled Note',
    type: 'note',
    text: 'They\'re not dead. They\'re CHANGED. I watched Ortega turn. He was fine one minute, then the lights flickered and he started screaming about the water being inside him. We locked him in the maintenance tunnel. He\'s still scratching at the door.',
    minLevel: 3,
    maxLevel: 10,
  },
  {
    id: 'log_03',
    title: 'Dr. Vex Research Log',
    type: 'audio_log',
    text: 'The organism doesn\'t just infect — it integrates. It rewrites motor function while preserving aggression. Test subjects retain memory fragments, which may explain the recognition pattern in their eyes. God help us, they remember who they were.',
    minLevel: 4,
    maxLevel: 12,
  },
  {
    id: 'term_02',
    title: 'Security Override Terminal',
    type: 'terminal',
    text: 'KEYCARD REQUIRED FOR DESCENT. Elevator access restricted to Level 4 clearance and above. Last known keycard holder: Security Chief Okoro. Last seen: Sector 7 dead-end storage. [NOTE ADDED IN BLOOD: he didn\'t make it]',
    minLevel: 2,
    maxLevel: 8,
  },
  {
    id: 'note_02',
    title: 'Torn Journal Page',
    type: 'note',
    text: 'The flashlight batteries are dying faster down here. Something drains them. Not the cold. Not the age. Something wants us in the dark. I found a crate of spares in the maintenance bay, but I could swear I heard breathing inside the crate.',
    minLevel: 5,
    maxLevel: 15,
  },
  {
    id: 'log_04',
    title: 'Facility Director\'s Confession',
    type: 'audio_log',
    text: 'I authorized the deep-core drilling. The company knew. They always knew what was buried here. A biological weapon, they called it. Contained for millennia by the pressure itself. We broke the seal. Every death since is on my hands. If you\'re hearing this, turn back. There is no rescue coming.',
    minLevel: 8,
    maxLevel: 20,
  },
  {
    id: 'note_03',
    title: 'Bloody Warning',
    type: 'note',
    text: 'DON\'T OPEN THE CRATES. The keycard is bait. They nest inside the supply crates. When you pop the latch, it comes out. I\'m the only one left in Sector 9 and I can hear —',
    minLevel: 6,
    maxLevel: 14,
  },
  {
    id: 'log_05',
    title: 'The Warden\'s Manifest',
    type: 'terminal',
    text: 'SUBJECT: WARDEN PROTOCOL. When all containment fails, the Warden activates. It is not a guardian. It is a janitor. It cleans the facility of all biological matter — infected or not. If you reach the boss chambers, you are the contamination it will remove.',
    minLevel: 8,
    maxLevel: 30,
  },
  {
    id: 'note_04',
    title: 'Crawler Sketch',
    type: 'note',
    text: 'Fast. God, they\'re fast. They crawl on all fours and they don\'t stop. The only warning is the clicking. If you hear clicking, DODGE. They pounce before you can blink. I watched Tanaka try to parry one — it tore through his guard like paper.',
    minLevel: 2,
    maxLevel: 12,
  },
  {
    id: 'note_05',
    title: 'Sentry Sighting',
    type: 'note',
    text: 'Something new in Sector 4. It glows. It stands in the corridor and it WATCHES. It doesn\'t chase — it just keeps distance and fires these... bolts of light. Corrupted Sentry, the terminals call it. You can\'t melee what won\'t come close.',
    minLevel: 4,
    maxLevel: 18,
  },
  {
    id: 'log_06',
    title: 'Acid Containment Breach',
    type: 'audio_log',
    text: 'The Spitters are the worst. They don\'t aim at you — they aim at the floor. They spit acid that pools and stays for seconds. It denies you ground. You\'re forced to keep moving, into worse threats. It\'s tactical. These things are LEARNING.',
    minLevel: 6,
    maxLevel: 20,
  },
  {
    id: 'term_03',
    title: 'Greatsword Armory Terminal',
    type: 'terminal',
    text: 'WEAPON CACHE — LEVEL 10 CLEARANCE. The Abyssal Greatsword. Forged from the trench hull plating. Its parry-slam channels kinetic force into a shockwave. The Warden fears it. Carry it into the arena and do not let the blade taste fear.',
    minLevel: 8,
    maxLevel: 12,
  },
  {
    id: 'term_04',
    title: 'Energy Blade Schematic',
    type: 'terminal',
    text: 'WEAPON CACHE — LEVEL 20 CLEARANCE. The Energy Blade. It catches incoming projectiles in its magnetic field and returns them to sender. Perfect against ranged enemies and barrages. The Sentry\'s light becomes your weapon.',
    minLevel: 18,
    maxLevel: 22,
  },
  {
    id: 'log_07',
    title: 'Final Transmission',
    type: 'audio_log',
    text: 'If you make it past Level 50... you\'ll reach the core. The thing that started all of this. I don\'t know what happens there. No one\'s come back. But the deeper you go, the more the walls whisper your name. They know you\'re coming. Good luck.',
    minLevel: 40,
    maxLevel: 50,
  },
  {
    id: 'note_06',
    title: 'Style is Survival',
    type: 'note',
    text: 'Someone scribbled on the training manual: "Don\'t just survive — FIGHT. Chain your hits, parry their strikes, mix your attacks. The style meter isn\'t cosmetic. The more stylish you are, the more the Abyss respects you. It\'s afraid of beauty in violence."',
    minLevel: 1,
    maxLevel: 50,
  },
  {
    id: 'note_07',
    title: 'Battery Conservation',
    type: 'note',
    text: 'Toggle the light off between fights. The battery regenerates when the beam is off. In the deep levels, darkness is a weapon they use against you — but a dead flashlight is a death sentence. Manage it.',
    minLevel: 2,
    maxLevel: 50,
  },
  {
    id: 'note_08',
    title: 'The Boons',
    type: 'note',
    text: 'After you kill a Warden — one of the big ones — the facility offers you a choice. Three boons. Health, speed, fury. I always took the fury. Regret it now, down here with broken bones and a blade too hot to hold. Choose with your head, not your rage.',
    minLevel: 10,
    maxLevel: 50,
  },
];

export class StorySystem {
  private collected = new Set<string>();
  private allEntries: Map<string, LoreEntry> = new Map();

  constructor() {
    for (const e of LORE_ENTRIES) this.allEntries.set(e.id, e);
  }

  get totalEntries(): number {
    return LORE_ENTRIES.length;
  }

  get collectedCount(): number {
    return this.collected.size;
  }

  get codexEntries(): CodexEntry[] {
    return LORE_ENTRIES.map((entry) => ({
      entry,
      collected: this.collected.has(entry.id),
    }));
  }

  /** Pick a lore entry appropriate for the given level. Returns null if none. */
  pickEntryForLevel(level: number): LoreEntry | null {
    const available = LORE_ENTRIES.filter(
      (e) => level >= e.minLevel && level <= e.maxLevel && !this.collected.has(e.id),
    );
    if (available.length === 0) return null;
    return pick(available);
  }

  /** Mark an entry as collected. Returns the entry (or null if already collected / unknown). */
  collect(entryId: string): LoreEntry | null {
    if (this.collected.has(entryId)) return null;
    const entry = this.allEntries.get(entryId);
    if (!entry) return null;
    this.collected.add(entryId);
    return entry;
  }

  hasCollected(entryId: string): boolean {
    return this.collected.has(entryId);
  }

  reset(): void {
    this.collected.clear();
  }
}
