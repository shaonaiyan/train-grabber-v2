export class AudioManager {
    static instance;
    ctx = null;
    isMuted = false;
    chugTimer = 0;
    static getInstance() {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }
    initContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    setMuted(muted) {
        this.isMuted = muted;
    }
    updateTrainRhythm(delta, speedRatio) {
        if (this.isMuted || speedRatio <= 0.05)
            return;
        this.chugTimer += delta * 0.001 * (1.5 * speedRatio);
        if (this.chugTimer >= 0.35) {
            this.chugTimer = 0;
            this.playChug();
        }
    }
    playChug() {
        if (this.isMuted || !this.ctx)
            return;
        try {
            const t = this.ctx.currentTime;
            // White noise buffer for steam burst
            const bufferSize = this.ctx.sampleRate * 0.08;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, t);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(t);
        }
        catch (_) { }
    }
    playHookLaunch() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }
    playHookHit() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.09);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.09);
    }
    playInstall() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        // Heavy metal clank (low thump + ringing high frequency)
        const oscLow = this.ctx.createOscillator();
        const gainLow = this.ctx.createGain();
        oscLow.type = 'sine';
        oscLow.frequency.setValueAtTime(140, t);
        oscLow.frequency.exponentialRampToValueAtTime(45, t + 0.3);
        gainLow.gain.setValueAtTime(0.35, t);
        gainLow.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        oscLow.connect(gainLow);
        gainLow.connect(this.ctx.destination);
        oscLow.start(t);
        oscLow.stop(t + 0.3);
        const oscHigh = this.ctx.createOscillator();
        const gainHigh = this.ctx.createGain();
        oscHigh.type = 'square';
        oscHigh.frequency.setValueAtTime(520, t);
        oscHigh.frequency.exponentialRampToValueAtTime(200, t + 0.15);
        gainHigh.gain.setValueAtTime(0.12, t);
        gainHigh.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        oscHigh.connect(gainHigh);
        gainHigh.connect(this.ctx.destination);
        oscHigh.start(t);
        oscHigh.stop(t + 0.15);
    }
    playDiscard() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
    }
    playTurretFire() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(750, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
    }
    playExplosion() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(40, t + 0.5);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    }
    playFuelGulp() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }
    playRepair() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(550, t);
        osc.frequency.setValueAtTime(750, t + 0.08);
        osc.frequency.setValueAtTime(950, t + 0.16);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }
    playSheep() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.linearRampToValueAtTime(380, t + 0.35);
        // Vibrato effect for sheep "baaa"
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 14;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 25;
        lfo.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + 0.35);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
    }
    playWarning() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.setValueAtTime(650, t + 0.12);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.24);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
    }
    playPowerShortage() {
        this.initContext();
        if (this.isMuted || !this.ctx)
            return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.linearRampToValueAtTime(70, t + 0.25);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    }
}
