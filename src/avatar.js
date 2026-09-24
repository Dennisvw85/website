// Live avatar: een pratend gezicht bij dezelfde CV-agent (Voice Live + text-to-speech-avatar).
// Volgt het patroon van Microsofts voice-live-avatar-sample: /api/avatar/token geeft een token van
// een aparte, minimale identiteit; de browser praat daarmee rechtstreeks met Voice Live.
// Microfoonaudio gaat over de WebSocket, beeld en geluid van de avatar komen via WebRTC.
(() => {
  const btn = document.getElementById('avatar-btn');
  const stage = document.getElementById('avatar-stage');
  const video = document.getElementById('avatar-video');
  const voice = document.getElementById('avatar-audio');
  const statusEl = document.getElementById('voice-status');
  if (!btn || !stage || !window.RTCPeerConnection || !window.AudioWorkletNode) {
    if (btn) btn.hidden = true;
    return;
  }

  const API_VERSION = '2026-01-01-preview';
  let s = null; // actieve sessie

  const status = (text) => { statusEl.hidden = !text; statusEl.textContent = text || ''; };

  function toBase64(int16) {
    const bytes = new Uint8Array(int16.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function stop(reason) {
    if (!s) return;
    const { ws, pc, stream, ctx, timer } = s;
    s = null;
    clearInterval(timer);
    stream && stream.getTracks().forEach((t) => t.stop());
    ctx && ctx.close();
    pc && pc.close();
    if (ws && ws.readyState <= 1) ws.close();
    video.srcObject = null;
    voice.srcObject = null;
    stage.hidden = true;
    btn.classList.remove('live');
    btn.setAttribute('aria-label', 'Start gesprek met avatar');
    status(reason || '');
  }

  async function connectVideo(ws, iceServers) {
    const pc = new RTCPeerConnection({ iceServers });
    pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    // Zoals Microsofts sample: elke track een eigen element. Met één element voor beide
    // overschreef de tweede track de eerste, en bleef de avatar stil "ademen".
    pc.ontrack = (e) => {
      const only = new MediaStream([e.track]);
      if (e.track.kind === 'video') {
        video.muted = true;
        video.srcObject = only;
        video.play().catch(() => {});
      } else {
        voice.srcObject = only;
        voice.play().catch(() => {});
      }
    };
    pc.createDataChannel('eventChannel');
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((r) => setTimeout(r, 2000)); // ICE-kandidaten verzamelen, zoals in de sample
    ws.send(JSON.stringify({
      type: 'session.avatar.connect',
      client_sdp: btoa(JSON.stringify(pc.localDescription)),
    }));
    return pc;
  }

  async function startMicrophone(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const ctx = new AudioContext({ sampleRate: 24000 });
    await ctx.audioWorklet.addModule('audio-processor.js');
    const node = new AudioWorkletNode(ctx, 'recorder-processor');
    node.port.onmessage = (e) => {
      if (ws.readyState !== 1) return;
      const f = e.data;
      const pcm = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) {
        const v = Math.max(-1, Math.min(1, f[i]));
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(pcm) }));
    };
    ctx.createMediaStreamSource(stream).connect(node);
    return { stream, ctx };
  }

  async function start() {
    status('Avatar wordt klaargezet…');
    let cfg;
    try {
      const res = await fetch('/api/avatar/token', { method: 'POST' });
      cfg = await res.json();
      if (!res.ok) throw new Error(cfg.error || 'Avatar is even niet beschikbaar.');
    } catch (err) {
      status(err.message);
      return;
    }

    const host = new URL(cfg.endpoint).host;
    const query = new URLSearchParams({
      'api-version': API_VERSION,
      'agent-name': cfg.agent_name,
      'agent-project-name': cfg.project_name,
      authorization: 'Bearer ' + cfg.token,
    });
    const ws = new WebSocket(`wss://${host}/voice-live/realtime?${query}`);
    s = { ws, pc: null, stream: null, ctx: null, timer: null };
    stage.hidden = false;
    btn.classList.add('live');
    btn.setAttribute('aria-label', 'Stop gesprek met avatar');

    ws.onopen = () => ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        voice: { name: 'en-US-AndrewMultilingualNeural', type: 'azure-standard' },
        turn_detection: { type: 'azure_semantic_vad_multilingual', silence_duration_ms: 600 },
        input_audio_sampling_rate: 24000,
        input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' },
        input_audio_echo_cancellation: { type: 'server_echo_cancellation' },
        avatar: {
          character: 'harry',
          style: 'business',
          output_protocol: 'webrtc',
          video: {
            codec: 'h264',
            resolution: { width: 1920, height: 1080 },
            crop: { top_left: [560, 0], bottom_right: [1360, 1080] },
            bitrate: 1000000,
          },
        },
      },
    }));

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (!s) return;
      try {
        if (msg.type === 'session.updated' && !s.pc) {
          const ice = (msg.session.avatar && msg.session.avatar.ice_servers) || [];
          s.pc = await connectVideo(ws, ice.map((i) => ({ urls: i.urls, username: i.username, credential: i.credential })));
        } else if (msg.type === 'session.avatar.connecting') {
          await s.pc.setRemoteDescription(JSON.parse(atob(msg.server_sdp)));
          Object.assign(s, await startMicrophone(ws));
          let left = cfg.max_seconds || 180;
          const tick = () => status(`Praat met de avatar (nog ${left} s). Klik 🧑‍💼 om te stoppen.`);
          tick();
          s.timer = setInterval(() => { left -= 1; tick(); if (left <= 0) stop('Tijd is om.'); }, 1000);
        } else if (msg.type === 'conversation.item.input_audio_transcription.completed' && msg.transcript) {
          bubble('user', msg.transcript.trim(), 'gesproken');
        } else if (msg.type === 'response.audio_transcript.done' && msg.transcript) {
          bubble('bot', msg.transcript.trim(), 'avatar');
        } else if (msg.type === 'error') {
          stop('Avatar-fout: ' + ((msg.error && msg.error.message) || 'onbekend'));
        }
      } catch (err) {
        stop(err.name === 'NotAllowedError' ? 'Geen toegang tot je microfoon.' : 'Avatar kon niet starten.');
      }
    };
    ws.onerror = () => stop('Verbinding met de avatar mislukt.');
    ws.onclose = () => stop('Gesprek beëindigd.');
  }

  btn.addEventListener('click', () => {
    if (s) return stop('Gesprek gestopt.');
    // Nooit twee gesprekken tegelijk: stop eerst de gewone spraak (🎙) als die loopt.
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn && voiceBtn.classList.contains('live')) voiceBtn.click();
    start();
  });
})();
