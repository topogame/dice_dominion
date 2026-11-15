import type { PlayerColor } from '../types/GameTypes';
import shieldBlue from './art/shield-blue.webp';
import shieldYellow from './art/shield-yellow.webp';
import shieldGreen from './art/shield-green.webp';
import shieldRed from './art/shield-red.webp';
import avatarBlue from './art/avatar-blue.webp';
import avatarYellow from './art/avatar-yellow.webp';
import avatarGreen from './art/avatar-green.webp';
import avatarRed from './art/avatar-red.webp';
import medallion from './art/medallion.webp';

/**
 * Painted HUD pieces, cut from the concept picture in reference/hedef-gorsel.webp:
 * each kingdom's heraldic shield and commander portrait, and the dice medallion.
 */
export const KINGDOM_ART: Record<PlayerColor, { shield: string; avatar: string }> = {
  blue: { shield: shieldBlue, avatar: avatarBlue },
  yellow: { shield: shieldYellow, avatar: avatarYellow },
  green: { shield: shieldGreen, avatar: avatarGreen },
  red: { shield: shieldRed, avatar: avatarRed },
};

export const MEDALLION_ART = medallion;
