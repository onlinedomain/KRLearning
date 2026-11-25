// Audio for a text: the recorded voice (mp3 + per-sentence timestamps) when
// available, otherwise the device's speech synthesis, sentence by sentence.
// Every state can be stopped instantly with stop().
import { audioUrl, audioTiming } from './data.js';
import { hasTTS, toast } from './util.js';

export class Player {
  /** @param sents [{ko, g}] flat list of sentences, g = global index */
  constructor(text, sents, { source = 'voice', rate = 1, onChange } = {}) {
    this.text = text;
    this.sents = sents;
    this.timing = audioTiming(text.id);
    this.mode = source === 'voice' && this.timing ? 'voice' : 'tts';
    this.rate = rate;
    this.onChange = onChange || (() => {});
    this.state = 'idle';     // idle | loading | playing | paused
    this.cur = -1;           // current sentence (global index)
    this.until = null;       // stop after this sentence (single-sentence play)
    this.token = 0;          // invalidates stale TTS callbacks
    this.audio = null;
    this.raf = 0;
    this.setupMediaSession();
  }

  emit() { this.onChange({ state: this.state, cur: this.cur, mode: this.mode }); }

  // ----- public API -----
  play(from = this.cur >= 0 ? this.cur : 0, until = null) {
    this.halt();
    this.until = until;
    this.cur = Math.max(0, Math.min(from, this.sents.length - 1));
    if (this.mode === 'voice') this.playVoice(); else this.playTTS();
  }
  playSentence(g) { this.play(g, g); }
  toggle() {
    if (this.state === 'playing' || this.state === 'loading') this.pause();
    else this.play(this.state === 'paused' ? this.cur : (this.cur >= 0 && this.cur < this.sents.length - 1 ? this.cur : 0));
  }
  pause() {
    this.halt();
    this.state = 'paused';
    this.emit();
  }
  stop() {
    this.halt();
    this.state = 'idle';
    this.cur = -1;
    this.until = null;
    this.emit();
  }
  step(d) {
    const g = Math.max(0, Math.min(this.sents.length - 1, (this.cur < 0 ? 0 : this.cur) + d));
    if (this.state === 'playing' || this.state === 'loading') this.play(g, this.until != null ? g : null);
    else { this.cur = g; this.emit(); }
  }
  setRate(r) {
    this.rate = r;
    if (this.audio) this.audio.playbackRate = r;
    if (this.mode === 'tts' && this.state === 'playing') this.play(this.cur, this.until);
  }
  destroy() {
    this.stop();
    this.dead = true;
    if (this.audio) { this.audio.removeAttribute('src'); this.audio.load(); this.audio = null; }
    if ('mediaSession' in navigator) {
      for (const a of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack']) try { navigator.mediaSession.setActionHandler(a, null); } catch {}
    }
  }

  // ----- internals -----
  halt() {
    this.token++;
    cancelAnimationFrame(this.raf);
    if (this.audio && !this.audio.paused) this.audio.pause();
    if (hasTTS()) speechSynthesis.cancel();
  }

  playVoice() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.src = audioUrl(this.text.id);
      this.audio.addEventListener('error', () => {
        if (this.dead || this.mode !== 'voice') return;
        toast('Voix enregistrée indisponible (hors ligne ?). Lecture avec la synthèse vocale.');
        this.mode = 'tts';
        if (this.state === 'playing' || this.state === 'loading') this.playTTS();
      });
      this.audio.addEventListener('ended', () => { if (this.state === 'playing') this.stop(); });
    }
    const a = this.audio;
    a.playbackRate = this.rate;
    const [start] = this.timing.s[this.cur];
    const seekAndPlay = () => {
      try { a.currentTime = start; } catch {}
      a.play().then(() => {
        this.state = 'playing'; this.emit(); this.tick(myToken);
      }).catch((e) => {
        if (e.name === 'AbortError') return;
        this.mode = 'tts'; this.playTTS();
      });
    };
    const myToken = this.token;
    this.state = 'loading'; this.emit();
    if (a.readyState >= 1) seekAndPlay();
    else a.addEventListener('loadedmetadata', () => myToken === this.token && seekAndPlay(), { once: true });
  }

  tick(token) {
    if (token !== this.token) return;
    const a = this.audio, s = this.timing.s, t = a.currentTime;
    // Advance the highlighted sentence when its end time passes.
    let g = this.cur;
    while (g < s.length - 1 && t >= s[g][1] - 0.02 && t >= s[g + 1][0] - 0.05) g++;
    if (this.until != null && t >= s[this.until][1]) { a.pause(); this.state = 'paused'; this.cur = this.until; this.until = null; this.emit(); return; }
    if (g !== this.cur) { this.cur = g; this.emit(); }
    this.raf = requestAnimationFrame(() => this.tick(token));
  }

  playTTS() {
    if (!hasTTS()) { toast('La synthèse vocale n’est pas disponible sur cet appareil.'); this.stop(); return; }
    const token = this.token;
    this.state = 'playing'; this.emit();
    const u = new SpeechSynthesisUtterance(this.sents[this.cur].ko.replace(/^[^:\s“"]{1,8}:\s*/, ''));
    u.lang = 'ko-KR'; u.rate = this.rate;
    const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith('ko'));
    if (v) u.voice = v;
    u.onend = () => {
      if (token !== this.token) return;
      if (this.until != null && this.cur >= this.until) { this.state = 'paused'; this.until = null; this.emit(); return; }
      if (this.cur >= this.sents.length - 1) { this.stop(); return; }
      this.cur++; this.emit(); this.playTTS();
    };
    u.onerror = (e) => { if (token === this.token && e.error !== 'interrupted' && e.error !== 'canceled') this.stop(); };
    speechSynthesis.speak(u);
  }

  setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: this.text.title, artist: this.text.titleEn, album: '다독+' });
      navigator.mediaSession.setActionHandler('play', () => this.toggle());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.step(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => this.step(1));
    } catch {}
  }
}
