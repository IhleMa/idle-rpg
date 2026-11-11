// Combat: fight the enemies of the current area (costs stamina), with an animated battle replay.
import { h, fmt, pct } from '../ui.js';
import { act } from '../main.js';
import { AREAS } from '/shared/data/areas.js';
import { ENEMIES } from '/shared/data/enemies.js';
import { RESOURCES } from '/shared/data/resources.js';
import { CONSUMABLES } from '/shared/data/items.js';
import { enemyStats, staminaCost } from '/shared/rules.js';
import { showBattle } from '../battle.js';

export const live = true;

function threat(state, foe) {
  const s = state.stats;
  const myDps = s.damage * s.attackSpeed / 2 * (1 + Math.min(s.critChance, 0.6) * s.critDmg);
  const red = (armor, lvl) => Math.min(0.75, armor / (armor + 40 + 12 * lvl));
  const mine = myDps * (1 - red(s.damageType === 'magic' ? foe.armor / 2 : foe.armor, state.character.level));
  const theirs = foe.damage * foe.attackSpeed / 2 * (1 + foe.critChance * 0.5) * (1 - red(foe.damageType === 'magic' ? s.armor / 2 : s.armor, foe.level)) * (1 - s.dodge);
  const ratio = (s.health / theirs) / (foe.maxHp / mine);
  if (ratio > 2.5) return ['Trivial', 'good'];
  if (ratio > 1.3) return ['Favourable', 'good'];
  if (ratio > 0.8) return ['Even', 'warn'];
  if (ratio > 0.45) return ['Dangerous', 'bad'];
  return ['Deadly', 'bad'];
}

export function render(state) {
  const c = state.character;
  if (c.activity.type === 'travel') return h('section', { class: 'panel' }, h('h2', {}, 'On the road'), h('p', {}, 'You cannot start fights while traveling.'));
  const area = AREAS[c.location];
  const potions = state.inventory.filter((i) => i.kind === 'consumable' && CONSUMABLES[i.base].effect.type === 'combat_heal');
  const cards = area.enemies.map((id) => {
    const e = ENEMIES[id];
    const foe = enemyStats(e);
    const cost = staminaCost(e);
    const [label, cls] = threat(state, foe);
    return h('div', { class: `panel enemy-card ${e.boss ? 'boss' : e.elite ? 'elite' : ''}` },
      h('div', { class: 'enemy-head' }, h('div', { class: 'enemy-icon' }, e.icon),
        h('div', {}, h('h2', {}, e.name, e.boss ? ' 👑' : e.elite ? ' ⭐' : ''), h('div', { class: 'muted small' }, `Level ${e.level}${e.boss ? ' Boss' : e.elite ? ' Elite' : ''}`))),
      h('div', { class: 'rates' },
        h('div', {}, h('span', { class: 'muted' }, 'Health'), h('b', {}, fmt(foe.maxHp))),
        h('div', {}, h('span', { class: 'muted' }, 'Damage'), h('b', {}, `${fmt(foe.damage)} ${foe.damageType === 'magic' ? '✨' : ''}`)),
        h('div', {}, h('span', { class: 'muted' }, 'Armor'), h('b', {}, fmt(foe.armor))),
        h('div', {}, h('span', { class: 'muted' }, 'Threat'), h('b', { class: cls }, label))),
      h('div', { class: 'small muted' }, 'Drops: ', e.drops.map((d) => `${RESOURCES[d.res].icon} ${RESOURCES[d.res].name} (${Math.round(d.chance * 100)}%)`).join(', '), e.boss ? ', guaranteed rare+ equipment, Boss Trophy' : ', equipment (rare)'),
      h('button', { class: `btn ${e.boss ? 'danger' : 'primary'} wide mt`, disabled: c.stamina < cost || undefined, onclick: async () => {
        const r = await act('/fight', { enemyId: id }, { rerender: true });
        if (!r) return;
        const rw = r.rewards;
        const outcome = h('div', { class: r.won ? 'win' : 'loss' }, h('h3', {}, r.won ? 'Victory!' : 'Defeat'),
          h('div', {}, `+${fmt(rw.xp)} XP`, rw.gold ? ` · +${fmt(rw.gold)} gold` : ''),
          Object.entries(rw.resources || {}).map(([res, n]) => h('div', {}, `${RESOURCES[res].icon} ${n}x ${RESOURCES[res].name}`)),
          (rw.items || []).map((it) => h('div', { class: `rarity-text-${it.rarity}` }, `🎁 ${it.name}`)),
          rw.inventoryFull ? h('div', { class: 'bad' }, 'An item dropped but your inventory was full!') : null,
          Object.keys(r.potionsUsed || {}).length ? h('div', { class: 'muted small' }, `Potions used: ${Object.entries(r.potionsUsed).map(([p, n]) => `${n}x ${CONSUMABLES[p].name}`).join(', ')}`) : null);
        showBattle(r, { title: `${c.name} vs ${e.name}`, outcome });
      } }, `Fight (⚡ ${cost})`));
  });
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, `Combat — ${area.name}`),
      h('p', { class: 'muted' }, `Fights cost stamina (regenerates 1 every ${c.staminaRegenSeconds / 60} minutes). Healing potions in your bags are drunk automatically below 35% health. Bosses always drop rare or better equipment.`)),
    h('div', { class: 'row gap wrap' }, h('span', { class: 'tag' }, `⚡ Stamina ${Math.floor(c.stamina)}/${c.staminaMax}`),
      potions.length ? potions.map((p) => h('span', { class: 'tag' }, `${CONSUMABLES[p.base].icon} ${p.quantity}x ${CONSUMABLES[p.base].name}`)) : h('span', { class: 'tag bad' }, 'No healing potions'),
      h('span', { class: 'tag' }, `Your power ${fmt(state.stats.power)} · crit ${pct(state.stats.critChance)}`)),
    h('div', { class: 'card-grid mt' }, cards));
}
