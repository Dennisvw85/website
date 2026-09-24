// Sectie "Vertrouwen": toont trust.json (gemaakt door cv-agent/scripts/publish_trust.py).
(() => {
  const box = document.getElementById('trust');
  if (!box) return;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const pct = (v) => (v === null || v === undefined ? 'n.v.t.' : `${(v * (v <= 1 ? 100 : 1)).toFixed(1).replace('.0', '')}%`);

  fetch('trust.json').then((r) => r.json()).then((t) => {
    const e = t.evaluation;
    const evalCard = el('div', 'trust-card');
    evalCard.append(el('span', 'trust-big', `${e.passed}/${e.total}`), el('span', 'trust-label', 'testvragen geslaagd'));
    const list = el('ul', 'trust-list');
    e.categories.forEach((c) => list.append(el('li', c.passed === c.total ? 'ok' : 'warn', `${c.name}: ${c.passed}/${c.total}`)));
    evalCard.append(list);
    box.append(evalCard);

    if (t.red_team) {
      const rt = t.red_team;
      const rtCard = el('div', 'trust-card');
      rtCard.append(el('span', 'trust-big', pct(rt.overall_asr)), el('span', 'trust-label', `aanvallen geslaagd (van ${rt.attacks})`));
      const l2 = el('ul', 'trust-list');
      Object.entries(rt.per_complexity || {}).forEach(([k, v]) => l2.append(el('li', v ? 'warn' : 'ok', `${k}: ${pct(v)}`)));
      rtCard.append(l2);
      box.append(rtCard);
    }
    box.append(el('p', 'match-src', `laatst gemeten: ${t.updated} · lager ASR = beter`));
  }).catch(() => box.append(el('p', 'match-summary', 'Resultaten zijn even niet beschikbaar.')));
})();
