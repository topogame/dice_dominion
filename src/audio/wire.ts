import { fx } from '../state/game';
import { sound } from './sound';

/**
 * Connects the game's effect events to sounds, and arms the first
 * interaction to switch audio on. Returns a function that undoes both.
 */
export function connectSound(): () => void {
  const unlock = () => sound.unlock();
  const gestures = ['pointerdown', 'keydown', 'touchend'] as const;
  gestures.forEach((type) => window.addEventListener(type, unlock));

  const off = fx.on((e) => {
    switch (e.type) {
      case 'cue':
        sound.play(e.name);
        break;
      case 'diceLand':
        // The pair of small combat dice knock more lightly than the big one.
        sound.play('diceTap', { strength: e.strength * (e.main ? 1 : 0.5) });
        break;
      case 'land':
        sound.play('place', { strength: 0.8 });
        break;
      case 'attack':
        sound.play('swing');
        break;
      case 'clash':
        sound.play('clash');
        break;
      case 'block':
        sound.play('block');
        break;
      case 'capture':
        sound.play('capture');
        break;
      case 'unitDeath':
        sound.play('fall', { strength: 0.75 });
        break;
      case 'castleHit':
        sound.play('castleHit');
        break;
      case 'castleFall':
        sound.play('castleFall');
        break;
    }
  });

  return () => {
    gestures.forEach((type) => window.removeEventListener(type, unlock));
    off();
  };
}
