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

// Live chat met de CV-agent: POST /api/chat, doorgestuurd naar de Function App.
const chat = document.getElementById('chat');
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
let previousResponseId = null;

function bubble(who, text, src) {
  const el = document.createElement('div');
  el.className = 'msg ' + who;
  // textContent, geen innerHTML: een antwoord van het model kan nooit HTML of scripts injecteren.
  el.textContent = text;
  if (src) {
    const s = document.createElement('span');
    s.className = 'src';
    s.textContent = src;
    el.appendChild(s);
  }
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function typing() {
  const el = document.createElement('div');
  el.className = 'msg bot';
  el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

if (chat && form) {
  bubble('bot', 'Hoi! Ik ben een AI-agent op Microsoft Foundry. Vraag me wat je wilt weten over de ervaring, certificeringen of projecten van Dennis.', 'agent · gpt-4.1-mini');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    input.disabled = true;
    bubble('user', message);
    const wait = typing();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, previous_response_id: previousResponseId }),
      });
      const data = await res.json().catch(() => ({}));
      wait.remove();
      if (res.ok) {
        previousResponseId = data.response_id;
        bubble('bot', data.answer);
      } else {
        bubble('bot', data.error || 'Er ging iets mis. Probeer het zo nog eens.');
      }
    } catch {
      wait.remove();
      bubble('bot', 'Geen verbinding met de assistent. Probeer het zo nog eens.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}
document.getElementById('year').textContent = new Date().getFullYear();
