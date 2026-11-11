// Gathering: activities available at the current location with live rates and drop tables.
import { h, fmt, pct, itemSlotEl } from '../ui.js';
import { act } from '../main.js';
import { AREAS, ACTIVITIES } from '/shared/data/areas.js';
import { RESOURCES } from '/shared/data/resources.js';
import { PROFESSIONS } from '/shared/data/professions.js';
import { SLOT_LABELS } from '/shared/data/items.js';
import { gatherRates } from '/shared/rules.js';

export const live = true;

export function render(state) {
  const c = state.character;
  const a = c.activity;
  if (a.type === 'travel') {
    return h('section', { class: 'panel' }, h('h2', {}, 'On the road'), h('p', {}, `You are traveling to ${AREAS[a.to].name}. Gathering is possible once you arrive.`));
  }
  const area = AREAS[c.location];
  const current = a.type === 'gather' ? a : null;
  const cards = Object.entries(area.activities).map(([id, table]) => {
    const def = ACTIVITIES[id];
    const prof = c.professions[def.profession];
    const tool = def.tool ? state.equipped.find((i) => i.slot === def.tool) : null;
    const rates = gatherRates(state.stats, def.profession, prof.level, def.baseSeconds);
    const total = table.drops.filter((d) => (d.lvl || 1) <= prof.level).reduce((s, d) => s + d.w, 0);
    const active = current?.activityId === id;
    const blocked = ['quest', 'craft'].includes(a.type);
    return h('div', { class: `panel gather-card ${active ? 'active' : ''}` },
      h('div', { class: 'panel-head' }, h('h2', {}, `${def.icon} ${def.name}`), h('span', { class: 'tag' }, `${PROFESSIONS[def.profession].name} Lv ${prof.level}`)),
      def.description ? h('p', { class: 'muted small' }, def.description) : null,
      h('div', { class: 'tool-line' },
        def.tool ? (tool ? h('div', { class: 'row gap center-v' }, itemSlotEl(tool, { cls: 'mini' }), h('span', { class: 'small' }, tool.name))
          : h('div', { class: 'bad small' }, `Requires a ${SLOT_LABELS[def.tool]} — buy one in Greenhollow or craft it.`)) : h('div', { class: 'muted small' }, 'No tool required')),
      h('div', { class: 'rates' },
        h('div', {}, h('span', { class: 'muted' }, 'Time per gather'), h('b', {}, `${rates.cycleSeconds.toFixed(1)}s`)),
        h('div', {}, h('span', { class: 'muted' }, 'Bonus yield'), h('b', {}, `+${pct(rates.yieldBonus)}`)),
        h('div', {}, h('span', { class: 'muted' }, 'Rare find'), h('b', {}, `x${rates.rareMult.toFixed(2)}`)),
        h('div', {}, h('span', { class: 'muted' }, 'Per hour'), h('b', {}, `~${fmt((3600 / rates.cycleSeconds) * (1 + rates.yieldBonus))}`))),
      h('table', { class: 'drops' },
        table.drops.map((d) => {
          const locked = (d.lvl || 1) > prof.level;
          return h('tr', { class: locked ? 'locked' : '' }, h('td', {}, `${RESOURCES[d.res].icon} ${RESOURCES[d.res].name}`),
            h('td', { class: 'muted' }, locked ? `Requires ${PROFESSIONS[def.profession].name} ${d.lvl}` : `${Math.round((d.w / total) * 100)}%`));
        }),
        (table.rares || []).map((r) => {
          const locked = (r.lvl || 1) > prof.level;
          return h('tr', { class: `rare ${locked ? 'locked' : ''}` }, h('td', {}, `${RESOURCES[r.res].icon} ${RESOURCES[r.res].name} ✨`),
            h('td', { class: 'muted' }, locked ? `Requires level ${r.lvl}` : `${pct(r.chance * rates.rareMult, 2)} rare`));
        })),
      active
        ? h('div', {},
          h('div', { class: 'bar gather' }, h('div', { class: 'bar-fill', dataset: { cycleStart: current.lastAt, cycleMs: current.cycleMs } })),
          h('div', { class: 'totals' }, Object.entries(current.totals).map(([r, n]) => h('span', { class: 'tag' }, `${RESOURCES[r].icon} ${fmt(n)}`))),
          h('button', { class: 'btn wide mt', onclick: () => act('/stop') }, 'Stop'))
        : h('button', { class: 'btn primary wide mt', disabled: (def.tool && !tool) || blocked || undefined, onclick: () => act('/gather', { activityId: id }, { success: `Started ${def.name.toLowerCase()}` }) },
          blocked ? 'Busy with another activity' : `Start ${def.name}`));
  });
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, `Gathering — ${area.name}`),
      h('p', { class: 'muted' }, 'Gathering continues while you are offline (up to 12 hours). Your profession levels, tools, race, equipment and stats all speed it up.')),
    h('div', { class: 'card-grid' }, cards));
}
