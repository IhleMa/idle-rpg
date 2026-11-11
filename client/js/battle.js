// Visual battle replay: animated health bars + streaming combat log from a server-side fight log.
import { h, modal, fmt } from './ui.js';

export function battleReplay({ log, fighters }, { title = 'Battle', outcome = null, speed = 1 } = {}) {
  const hpBars = fighters.map((f, i) => {
    const fill = h('div', { class: `bar-fill ${i === 0 ? 'hp-you' : 'hp-foe'}`, style: { width: '100%' } });
    const shield = h('div', { class: 'shield-fill', style: { width: '0%' } });
    const label = h('span', { class: 'bar-label' }, `${fmt(f.maxHp)} / ${fmt(f.maxHp)}`);
    const card = h('div', { class: `fighter ${i === 0 ? 'left' : 'right'}` },
      h('div', { class: 'fighter-icon' }, f.icon || '⚔️'),
      h('div', { class: 'fighter-name' }, f.name, h('span', { class: 'muted small' }, ` Lv ${f.level}`)),
      h('div', { class: 'bar hp' }, fill, shield, label));
    return { fill, shield, label, card, max: f.maxHp };
  });
  const feed = h('div', { class: 'battle-log' });
  const result = h('div', { class: 'battle-result hidden' });
  const skipBtn = h('button', { class: 'btn small ghost' }, 'Skip to end');
  const el = h('div', { class: 'battle' }, h('div', { class: 'fighters' }, hpBars[0].card, h('div', { class: 'vs' }, 'VS'), hpBars[1].card), feed, result, h('div', { class: 'row end' }, skipBtn));

  let i = 0;
  let timer = null;
  const apply = (e, animate = true) => {
    e.hp.forEach((hp, k) => {
      hpBars[k].fill.style.width = `${(hp / hpBars[k].max) * 100}%`;
      hpBars[k].shield.style.width = `${Math.min(100, ((e.sh?.[k] || 0) / hpBars[k].max) * 100)}%`;
      hpBars[k].label.textContent = `${fmt(hp)} / ${fmt(hpBars[k].max)}`;
    });
    const line = h('div', { class: `log-line k-${e.kind} a-${e.a}` }, h('span', { class: 'log-t' }, `${e.t.toFixed(1)}s`), e.text);
    feed.append(line);
    feed.scrollTop = feed.scrollHeight;
    if (animate && ['hit', 'crit', 'dot'].includes(e.kind)) {
      const target = hpBars[1 - e.a].card;
      target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake');
      const pop = h('div', { class: `dmg-pop ${e.kind}` }, `-${e.value}`);
      target.append(pop);
      setTimeout(() => pop.remove(), 900);
    }
    if (animate && ['heal', 'potion', 'leech'].includes(e.kind)) {
      const me = hpBars[e.a].card;
      const pop = h('div', { class: 'dmg-pop heal' }, `+${e.value}`);
      me.append(pop);
      setTimeout(() => pop.remove(), 900);
    }
  };
  const finish = () => {
    clearTimeout(timer);
    while (i < log.length) apply(log[i++], false);
    skipBtn.remove();
    if (outcome) { result.replaceChildren(outcome); result.classList.remove('hidden'); }
  };
  const step = () => {
    if (!el.isConnected && i > 0) return;
    if (i >= log.length) return finish();
    const e = log[i++];
    apply(e);
    const next = log[i];
    const gap = next ? Math.min(900, Math.max(180, (next.t - e.t) * 450)) / speed : 0;
    timer = setTimeout(step, gap);
  };
  skipBtn.onclick = finish;
  timer = setTimeout(step, 400);
  return el;
}

export function showBattle(fight, opts = {}) {
  return modal(opts.title || 'Battle', battleReplay(fight, opts), { wide: true });
}
