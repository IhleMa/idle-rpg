import { h, fmt, progressBar } from '../ui.js';
import { PROFESSIONS, PROFESSION_MAX_LEVEL } from '/shared/data/professions.js';
import { formatStat } from '/shared/data/stats.js';
import { profXpForLevel } from '/shared/rules.js';

export const live = true;

export function render(state) {
  const c = state.character;
  const card = ([id, p]) => {
    const prog = c.professions[id];
    const need = profXpForLevel(prog.level);
    return h('div', { class: 'panel prof-card' },
      h('div', { class: 'panel-head' }, h('h2', {}, `${p.icon} ${p.name}`), h('span', { class: 'level-badge' }, prog.level)),
      progressBar(prog.level >= PROFESSION_MAX_LEVEL ? 1 : prog.xp, prog.level >= PROFESSION_MAX_LEVEL ? 1 : need, { label: prog.level >= PROFESSION_MAX_LEVEL ? 'Mastered' : `${fmt(prog.xp)} / ${fmt(need)} XP` }),
      h('p', { class: 'small muted' }, p.description),
      h('div', { class: 'perks' }, p.perks.map((pk) => h('div', { class: `perk ${prog.level >= pk.level ? 'unlocked' : ''}` },
        h('span', { class: 'perk-lvl' }, pk.level), h('div', {}, h('b', {}, pk.name), h('div', { class: 'small' }, Object.entries(pk.stats).map(([k, v]) => formatStat(k, v)).join(', ')))))),
      h('p', { class: 'small muted' }, `Each level also grants +1% speed and +0.8% yield${p.kind === 'gathering' ? ', +1% rare discovery, and unlocks new resources' : ' and better item quality'}.`));
  };
  const entries = Object.entries(PROFESSIONS);
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Professions'), h('p', { class: 'muted' }, 'Professions level independently of your character. Specialise, then trade your surplus on the Auction House.')),
    h('h2', { class: 'section-title' }, 'Gathering'),
    h('div', { class: 'card-grid' }, entries.filter(([, p]) => p.kind === 'gathering').map(card)),
    h('h2', { class: 'section-title' }, 'Crafting'),
    h('div', { class: 'card-grid' }, entries.filter(([, p]) => p.kind === 'crafting').map(card)));
}
