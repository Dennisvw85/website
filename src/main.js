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

function bubble(who, text, src, meta) {
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
  if (meta) {
    const m = document.createElement('span');
    m.className = 'src meta';
    m.textContent = meta;
    el.appendChild(m);
  }
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function chatMeta(model, tokens, latencyMs) {
  const parts = [];
  if (model) parts.push(model);
  if (tokens) parts.push(`${(tokens / 1000).toFixed(1)}k tokens`);
  if (latencyMs) parts.push(`${(latencyMs / 1000).toFixed(1)} s`);
  return parts.length ? parts.join(' · ') : undefined;
}

function typing() {
  const el = document.createElement('div');
  el.className = 'msg bot';
  el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function showFollowups(questions) {
  const old = chat.querySelector('.followups');
  if (old) old.remove();
  if (!questions || !questions.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'followups';
  questions.forEach((q) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = q; // textContent: nooit modeloutput als HTML
    chip.addEventListener('click', () => {
      wrap.remove();
      input.value = q;
      form.requestSubmit();
    });
    wrap.appendChild(chip);
  });
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
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
        const src = data.sources && data.sources.length ? `bron: ${data.sources.join(', ')}` : undefined;
        bubble('bot', data.answer, src, chatMeta(data.model, data.tokens, data.latency_ms));
        showFollowups(data.followups);
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
// Spraakgesprek met dezelfde agent: WebRTC rechtstreeks met Voice Live in Azure.
// De backend (/api/voice) doet alleen de handshake met zijn managed identity; de browser ziet nooit een token.
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');
let call = null;

function setVoiceStatus(text) {
  voiceStatus.hidden = !text;
  voiceStatus.textContent = text || '';
}

async function stopVoice(reason) {
  if (!call) return;
  const { pc, stream, audio, timer, sessionId } = call;
  call = null;
  clearInterval(timer);
  stream.getTracks().forEach((t) => t.stop());
  pc.close();
  audio.remove();
  voiceBtn.classList.remove('live');
  voiceBtn.setAttribute('aria-label', 'Start spraakgesprek');
  setVoiceStatus(reason || '');
  if (sessionId) {
    fetch('/api/voice/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  }
}

async function startVoice() {
  setVoiceStatus('Verbinden…');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setVoiceStatus('Geen toegang tot je microfoon.');
    return;
  }
  const pc = new RTCPeerConnection();
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  const audio = document.createElement('audio');
  audio.autoplay = true;
  document.body.appendChild(audio);
  pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

  // Transcripties van beide kanten komen binnen via het datakanaal en verschijnen als chatberichten.
  const events = pc.createDataChannel('voice-live-events');
  events.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'conversation.item.input_audio_transcription.completed' && msg.transcript) {
      bubble('user', msg.transcript.trim(), 'gesproken');
    } else if (msg.type === 'response.audio_transcript.done' && msg.transcript) {
      bubble('bot', msg.transcript.trim(), 'gesproken antwoord');
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') stopVoice('Gesprek beëindigd.');
  };

  await pc.setLocalDescription(await pc.createOffer());
  await new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); };
    setTimeout(resolve, 3000);
  });

  let data;
  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp_offer: pc.localDescription.sdp }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Spraak is even niet beschikbaar.');
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    pc.close();
    audio.remove();
    setVoiceStatus(err.message);
    return;
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp_answer });

  let left = data.max_seconds || 180;
  const timer = setInterval(() => {
    left -= 1;
    setVoiceStatus(`Luistert… stel je vraag hardop (nog ${left} s). Klik 🎙 om te stoppen.`);
    if (left <= 0) stopVoice('Tijd is om. Klik 🎙 voor een nieuw gesprek.');
  }, 1000);
  call = { pc, stream, audio, timer, sessionId: data.session_id };
  voiceBtn.classList.add('live');
  voiceBtn.setAttribute('aria-label', 'Stop spraakgesprek');
  setVoiceStatus(`Luistert… stel je vraag hardop (nog ${left} s). Klik 🎙 om te stoppen.`);
}

if (voiceBtn) {
  if (!window.RTCPeerConnection || !navigator.mediaDevices) {
    voiceBtn.hidden = true;
  } else {
    voiceBtn.addEventListener('click', () => {
      if (call) return stopVoice('Gesprek gestopt.');
      // Nooit twee gesprekken tegelijk: stop eerst de avatar (🧑‍💼) als die loopt.
      const avatarBtn = document.getElementById('avatar-btn');
      if (avatarBtn && avatarBtn.classList.contains('live')) avatarBtn.click();
      startVoice();
    });
  }
}

document.getElementById('year').textContent = new Date().getFullYear();
