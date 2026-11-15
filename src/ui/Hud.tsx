import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BonusType, PlayerColor, PlayerState } from '../types/GameTypes';
import { HUMAN_ID, currentPlayer, useGame, type CombatView, type TurnOption } from '../state/game';
import { KINGDOMS } from '../theme';
import { sound, useSoundEnabled } from '../audio/sound';
import { KINGDOM_ART, MEDALLION_ART } from './art';
import './hud.css';

const kingdomVar = (color: string) => ({ '--k': color }) as CSSProperties;

/** The kingdom a 3D colour belongs to; combat reports carry the colour only. */
const teamOf = (color: string): PlayerColor =>
  (Object.keys(KINGDOMS) as PlayerColor[]).find((team) => KINGDOMS[team].color === color) ?? 'blue';

/** Wraps a button handler so every press also gives a click. */
const pressed = (action: () => void) => () => {
  sound.play('click');
  action();
};

/** Outline of a heraldic shield in a 74x88 box; the painted shields are clipped to it. */
const SHIELD_PATH = 'M37 1 L72.5 8 L71.5 40 C70 62 54 77 37 87 C20 77 4 62 2.5 40 L1.5 8 Z';

/** Shapes and gradients shared by every SVG in the HUD. */
function SharedDefs() {
  return (
    <svg className="defs" width="0" height="0" aria-hidden="true">
      <defs>
        <clipPath id="dd-shield">
          <path d={SHIELD_PATH} />
        </clipPath>
        <linearGradient id="dd-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="0.45" stopColor="#f0c765" />
          <stop offset="1" stopColor="#8f6420" />
        </linearGradient>
        <linearGradient id="dd-navy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17234a" />
          <stop offset="1" stopColor="#070b18" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Shield({ team, className = '' }: { team: PlayerColor; className?: string }) {
  return (
    <svg className={`shield ${className}`} viewBox="0 0 74 88" aria-hidden="true">
      <image href={KINGDOM_ART[team].shield} width="74" height="88" preserveAspectRatio="none" clipPath="url(#dd-shield)" />
      <path d={SHIELD_PATH} className="shield-rim" stroke="url(#dd-gold)" />
    </svg>
  );
}

/** The crowned crest that hangs from the top of the screen. */
function CrownCrest() {
  // Six leaves up each side of the crown make the laurel.
  const leaves = Array.from({ length: 6 }, (_, i) => {
    const a = (-70 + i * 26) * (Math.PI / 180);
    const x = 210 - 27 * Math.cos(a);
    const y = 38 - 27 * Math.sin(a) * 0.82;
    return { x, y, turn: -(a * 180) / Math.PI + 58 };
  });
  return (
    <svg className="crown-crest" viewBox="0 0 420 78" aria-hidden="true">
      <path
        className="crest-plate"
        fill="url(#dd-navy)"
        stroke="url(#dd-gold)"
        d="M0 0 H420 L400 11 H322 L306 24 H258 V40 C258 58 236 68 210 76 C184 68 162 58 162 40 V24 H114 L98 11 H20 Z"
      />
      <path className="crest-line" d="M44 5 H150 M270 5 H376 M126 17 H160 M260 17 H294" />
      <path className="crest-inner" d="M210 70 C190 63 168 55 168 40 V6 H252 V40 C252 55 230 63 210 70 Z" />
      {[1, -1].map((side) => (
        <g key={side} transform={side === 1 ? undefined : 'translate(420 0) scale(-1 1)'}>
          {leaves.map((leaf, i) => (
            <ellipse key={i} fill="#e3b556" cx={leaf.x} cy={leaf.y} rx="5.2" ry="2.1" transform={`rotate(${leaf.turn} ${leaf.x} ${leaf.y})`} />
          ))}
        </g>
      ))}
      <path fill="url(#dd-gold)" d="M195 47 L191 26 L200 34 L204 21 L210 31 L216 21 L220 34 L229 26 L225 47 Z" />
      <path fill="url(#dd-gold)" d="M194 49.5 H226 V53 H194 Z" />
      {[191, 204, 216, 229].map((x, i) => (
        <circle key={x} fill="#f6d98a" cx={x} cy={i === 0 || i === 3 ? 24.5 : 19.5} r="2" />
      ))}
    </svg>
  );
}

function SoundToggle() {
  const on = useSoundEnabled();
  return (
    <button
      className={`icon-button frame${on ? '' : ' is-off'}`}
      onClick={() => {
        sound.setEnabled(!on);
        if (!on) sound.play('click');
      }}
      aria-pressed={on}
      aria-label={on ? 'Mute sound' : 'Turn sound on'}
      title={on ? 'Mute sound' : 'Turn sound on'}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" />
        {on ? (
          <path d="M13 7a4.2 4.2 0 0 1 0 6M15.2 4.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        ) : (
          <path d="M13 7.5l5 5M18 7.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

/** Shown only where the browser can go full screen (not on iPhones). */
function FullscreenToggle() {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  const label = full ? 'Leave full screen' : 'Full screen';
  return (
    <button
      className="icon-button frame"
      onClick={pressed(() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      })}
      aria-pressed={full}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d={full ? 'M7.5 3v4.5H3M12.5 3v4.5H17M7.5 17v-4.5H3M12.5 17v-4.5H17' : 'M3 7.5V3h4.5M17 7.5V3h-4.5M3 12.5V17h4.5M17 12.5V17h-4.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Starts a new match. Once a match is under way it asks for a second press. */
function RestartButton({ needsConfirm, onRestart }: { needsConfirm: boolean; onRestart: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = () => {
    sound.play('click');
    if (needsConfirm && !armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    onRestart();
  };

  return (
    <button
      className={`icon-button frame${armed ? ' is-armed' : ''}`}
      onClick={press}
      aria-label={armed ? 'Press again to start a new match' : 'New match'}
      title={armed ? 'Press again to start a new match' : 'New match'}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M15.6 6.2A6.6 6.6 0 1 0 16.6 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16.4 2.6v4.2h-4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {armed && <span className="armed-note">Again to restart</span>}
    </button>
  );
}

const BONUS_TAG: Record<BonusType, { tag: string; title: string }> = {
  attack: { tag: 'Atk', title: 'Attack boost: +1 to attack rolls' },
  defense: { tag: 'Def', title: 'Defense shield: +1 to defense rolls' },
  speed: { tag: 'Spd', title: 'Speed bonus: +2 units per roll' },
  bridge: { tag: 'Brg', title: 'Bridge builder' },
};

const CHOICES: { option: TurnOption; title: string; sub: string }[] = [
  { option: 'A', title: 'Expand', sub: 'Roll and place units' },
  { option: 'B', title: 'Strike & Expand', sub: 'One attack, then roll if you win' },
  { option: 'C', title: 'Double Strike', sub: 'Two attacks, no new units' },
];

function PlayerPlate({ player, active, strongest }: { player: PlayerState; active: boolean; strongest: number }) {
  const k = KINGDOMS[player.color];
  const share = player.isAlive ? Math.max(4, Math.round((player.unitCount / strongest) * 100)) : 0;
  return (
    <div
      className={`plate frame${active ? ' is-active' : ''}${player.isAlive ? '' : ' is-out'}`}
      style={kingdomVar(k.color)}
      title={player.id === HUMAN_ID ? `${k.name} (you)` : k.name}
    >
      <Shield team={player.color} className="plate-shield" />
      <span className="plate-avatar">
        <img src={KINGDOM_ART[player.color].avatar} alt="" draggable={false} />
      </span>
      <div className="plate-body">
        <div className="plate-top">
          <span className="hp" aria-label={`Castle ${player.castleHP} of ${player.castleMaxHP}`}>
            {Array.from({ length: player.castleMaxHP }, (_, i) => (
              <i key={i} className={i < player.castleHP ? 'on' : ''} />
            ))}
          </span>
          {player.id === HUMAN_ID && <span className="plate-you">You</span>}
        </div>
        <div className="meter" aria-label={player.isAlive ? `${player.unitCount} units` : 'Fallen'}>
          <b>{player.isAlive ? player.unitCount : '–'}</b>
          <span>
            <i style={{ width: `${share}%` }} />
          </span>
          {player.activeBonuses.map((bonus, i) => (
            <span key={i} className="bonus" title={BONUS_TAG[bonus.type].title}>
              {BONUS_TAG[bonus.type].tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The two dice of a fight, side by side, with the outcome underneath. */
function CombatCard({ combat }: { combat: CombatView }) {
  const rolling = combat.stage === 'rolling';
  const side = (s: CombatView['attacker'], won: boolean) => (
    <div className={`fighter${!rolling && won ? ' is-winner' : ''}`} style={kingdomVar(s.color)}>
      <Shield team={teamOf(s.color)} />
      <span className="rolled">{rolling ? '?' : s.roll}</span>
      {s.bonus > 0 && <span className="plus">+{s.bonus}</span>}
    </div>
  );
  return (
    <div className="combat frame">
      <div className="combat-row">
        {side(combat.attacker, combat.stage === 'won')}
        <span className="versus">vs</span>
        {side(combat.defender, combat.stage === 'lost')}
      </div>
      <div className="combat-line">{rolling ? 'The dice are cast…' : combat.outcome}</div>
    </div>
  );
}

export function Hud() {
  const gs = useGame((s) => s.gs);
  useGame((s) => s.version);
  const phase = useGame((s) => s.phase);
  const placementsLeft = useGame((s) => s.placementsLeft);
  const placementsTotal = useGame((s) => s.placementsTotal);
  const diceValue = useGame((s) => s.dice.main.value);
  const banner = useGame((s) => s.banner);
  const combat = useGame((s) => s.combat);
  const winner = useGame((s) => s.winner);
  const selected = useGame((s) => s.selected);
  const attacksLeft = useGame((s) => s.attacksLeft);
  const committed = useGame((s) => s.committed);
  const roll = useGame((s) => s.roll);
  const chooseOption = useGame((s) => s.chooseOption);
  const cancelAttack = useGame((s) => s.cancelAttack);
  const restart = useGame((s) => s.restart);

  const current = currentPlayer(gs);
  const k = KINGDOMS[current.color];
  const players = Object.values(gs.players);
  const yours = current.id === HUMAN_ID;
  const champion = winner ? gs.players[winner] : null;
  const canRoll = phase === 'ready' && yours;
  // The army bars are drawn against the largest army on the board.
  const strongest = Math.max(8, ...players.map((p) => p.unitCount));

  return (
    <div className="hud">
      <SharedDefs />

      <header className="top">
        <div className="top-left">
          <div className="turn-badge frame" title={`Turn ${gs.currentTurn}`}>
            <small>Turn</small>
            <b>{gs.currentTurn}</b>
          </div>
          <div className="turn-pips frame" aria-label={`${k.name} to play`} title={`${k.name} to play`}>
            {players.map((p) => (
              <i
                key={p.id}
                className={`${p.id === current.id ? 'on' : ''}${p.isAlive ? '' : ' out'}`}
                style={kingdomVar(KINGDOMS[p.color].color)}
              />
            ))}
          </div>
        </div>

        <CrownCrest />

        <div className="top-right">
          <SoundToggle />
          <FullscreenToggle />
          <RestartButton needsConfirm={gs.currentTurn > 1 && phase !== 'over'} onRestart={restart} />
        </div>
      </header>

      {banner && phase !== 'over' && (
        <div className="banner" key={banner.id} style={kingdomVar(banner.color)}>
          <div className="banner-title">{banner.text}</div>
          {banner.sub && <div className="banner-sub">{banner.sub}</div>}
        </div>
      )}

      <div className="bottom-stack">
        {phase === 'choosing' && (
          <div className="choices">
            {CHOICES.map((c) => (
              <button key={c.option} className={`choice frame choice-${c.option}`} onClick={pressed(() => chooseOption(c.option))}>
                <span className="choice-title">{c.title}</span>
                <span className="choice-sub">{c.sub}</span>
              </button>
            ))}
          </div>
        )}

        <footer className="bottom">
          <div className="plates">
            {players.slice(0, 2).map((p) => (
              <PlayerPlate key={p.id} player={p} active={p.id === current.id} strongest={strongest} />
            ))}
          </div>

          <div className="action" style={kingdomVar(k.color)}>
            <div className="action-status">
              {canRoll && <div className="status frame status-ready">Roll the die</div>}

              {phase === 'attacking' && (
                <div className="status frame status-attack">
                  <div className="status-main">{selected ? 'Choose a target' : 'Choose your attacker'}</div>
                  <div className="status-sub">
                    {attacksLeft} {attacksLeft === 1 ? 'attack' : 'attacks'} left
                    {!committed && (
                      <button className="back" onClick={pressed(cancelAttack)}>
                        Back
                      </button>
                    )}
                  </div>
                </div>
              )}

              {phase === 'combat' && combat && <CombatCard combat={combat} />}

              {phase === 'rolling' && <div className="status frame">{yours ? 'Rolling…' : `${k.short} is rolling…`}</div>}

              {phase === 'placing' && (
                <div className="status frame">
                  <div className="status-main">
                    <span className="rolled">{diceValue}</span>
                    Place your units
                  </div>
                  <div className="pips">
                    {Array.from({ length: placementsTotal }, (_, i) => (
                      <i key={i} className={i < placementsLeft ? 'on' : ''} />
                    ))}
                  </div>
                </div>
              )}

              {phase === 'waiting' && <div className="status frame">{yours ? 'Turn complete' : `${k.name} is moving`}</div>}
            </div>

            <button
              className={`medal${canRoll ? ' is-ready' : ''}${yours && phase !== 'over' ? ' is-yours' : ''}`}
              onClick={pressed(roll)}
              disabled={!canRoll}
              aria-label="Roll the die"
              title={canRoll ? 'Roll the die' : undefined}
            >
              <img src={MEDALLION_ART} alt="" draggable={false} />
            </button>
          </div>

          <div className="plates">
            {players.slice(2).map((p) => (
              <PlayerPlate key={p.id} player={p} active={p.id === current.id} strongest={strongest} />
            ))}
          </div>
        </footer>
      </div>

      {phase === 'over' && champion && (
        <div className="victory" style={kingdomVar(KINGDOMS[champion.color].color)}>
          <div className="victory-card frame">
            <Shield team={champion.color} className="victory-shield" />
            <div className="victory-kicker">{champion.id === HUMAN_ID ? 'Victory' : 'Defeat'}</div>
            <div className="victory-title">{champion.displayName}</div>
            <div className="victory-sub">
              rules the realm after {gs.currentTurn} {gs.currentTurn === 1 ? 'turn' : 'turns'}
            </div>
            <button className="gold-button" onClick={pressed(restart)}>
              New match
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
