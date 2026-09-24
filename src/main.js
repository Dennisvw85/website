// Thema-wissel met een cirkel-overgang (View Transitions) waar de browser het kan.
const root = document.documentElement;
const btn = document.querySelector('.theme');

function currentTheme() {
  if (root.dataset.theme) return root.dataset.theme;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

btn.addEventListener('click', (e) => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (err) {}
  };
  root.style.setProperty('--vx', e.clientX + 'px');
  root.style.setProperty('--vy', e.clientY + 'px');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduce) document.startViewTransition(apply);
  else apply();
});

// Spotlight die de muis volgt op de bento-tegels.
document.querySelectorAll('.tile').forEach((tile) => {
  tile.addEventListener('pointermove', (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', e.clientX - r.left + 'px');
    tile.style.setProperty('--my', e.clientY - r.top + 'px');
  });
});

// Voorbeeldgesprek in de hero, een voorproefje van de CV-agent.
const chat = document.getElementById('chat');
const script = [
  { who: 'user', text: 'Wat doet Dennis nu?' },
  { who: 'bot', text: 'Hij is AI Consultant bij RawWorks en bouwt multi-agent systemen met Copilot Studio en Azure AI Foundry.', src: 'bron: ervaring' },
  { who: 'user', text: 'En welke certificeringen heeft hij?' },
  { who: 'bot', text: 'Onder andere Microsoft 365 Administrator Expert, AZ-104 en AI Transformation Leader. Twaalf in totaal.', src: 'bron: certificeringen' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function bubble(who, html) {
  const el = document.createElement('div');
  el.className = 'msg ' + who;
  el.innerHTML = html;
  chat.appendChild(el);
  return el;
}

async function play() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  while (true) {
    chat.innerHTML = '';
    for (const m of script) {
      if (m.who === 'bot') {
        const t = bubble('bot', '<span class="typing"><i></i><i></i><i></i></span>');
        await wait(reduce ? 0 : 1100);
        t.innerHTML = m.text + '<span class="src">' + m.src + '</span>';
      } else {
        bubble('user', m.text);
      }
      await wait(reduce ? 0 : 1300);
    }
    if (reduce) return;
    await wait(4500);
  }
}

if (chat) play();
document.getElementById('year').textContent = new Date().getFullYear();
