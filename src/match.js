// Vacature-check: tekst of PDF naar /api/match; resultaat is structured output van de agent "cv-matcher".
(() => {
  const form = document.getElementById('match-form');
  if (!form) return;
  const text = document.getElementById('match-text');
  const pdf = document.getElementById('match-pdf');
  const fileLabel = document.getElementById('match-file-label');
  const btn = document.getElementById('match-btn');
  const out = document.getElementById('match-result');
  const STATUS = { met: 'voldaan', partial: 'deels', gap: 'ontbreekt' };

  const el = (tag, cls, content) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (content !== undefined) n.textContent = content; // nooit innerHTML met modeloutput
    return n;
  };

  pdf.addEventListener('change', () => {
    fileLabel.textContent = pdf.files[0] ? pdf.files[0].name : 'of upload een PDF';
  });

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  function render(d) {
    out.replaceChildren();
    if (!d.is_job_description) {
      out.append(el('p', 'match-summary', d.summary || 'Dit lijkt geen vacature.'));
      return;
    }
    const head = el('div', 'match-head');
    const score = el('div', 'match-score', String(d.score));
    score.style.setProperty('--p', d.score);
    const title = el('div', 'match-title');
    title.append(el('h3', '', d.job_title || 'Vacature'), el('p', 'match-summary', d.summary));
    head.append(score, title);

    const list = el('ul', 'match-reqs');
    for (const r of d.requirements || []) {
      const li = el('li', `req ${r.status}`);
      li.append(el('span', 'req-status', STATUS[r.status] || r.status), el('strong', '', r.requirement), el('p', '', r.evidence));
      list.append(li);
    }

    const qs = el('div', 'match-questions');
    qs.append(el('h4', '', 'Vragen om in een gesprek te stellen'));
    const ol = el('ol');
    (d.interview_questions || []).forEach((q) => ol.append(el('li', '', q)));
    qs.append(ol);

    out.append(head, list, qs, el('p', 'match-src', `bron: ${d.source === 'pdf' ? 'PDF via Content Understanding' : 'geplakte tekst'} · agent: cv-matcher · structured output`));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = pdf.files[0];
    if (!file && text.value.trim().length < 80) {
      out.hidden = false;
      out.replaceChildren(el('p', 'match-summary', 'Plak een volledige vacaturetekst of kies een PDF.'));
      return;
    }
    btn.disabled = true;
    btn.textContent = file ? 'PDF lezen en vergelijken…' : 'Vergelijken…';
    out.hidden = false;
    out.replaceChildren(el('p', 'match-summary', 'De agent leest de vacature en zoekt bewijs in het CV en de repo’s. Dit duurt 10 tot 30 seconden.'));
    try {
      const body = file
        ? { pdf_base64: await toBase64(file) }
        : { text: text.value.trim() };
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'De check is even niet beschikbaar.');
      render(data);
    } catch (err) {
      out.replaceChildren(el('p', 'match-summary', err.message));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check de match';
    }
  });
})();
