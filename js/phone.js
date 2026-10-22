'use strict';
/* ---------------------------------------------------------------------------
 * phone.js - the phone calls. Scripts are original text written for this
 * recreation; delivered via speech synthesis (when available) plus captions.
 * ------------------------------------------------------------------------- */
(function () {
  const P = FNAF.Phone = {};
  const A = () => FNAF.Audio;

  P.SCRIPTS = {
    1: [
      { text: "Hello? Hello... hey, uh, okay. I'm recording this so you've got something to listen to on your first night. Figured it might help you settle in." },
      { text: "I used to sit in that same chair, actually. This is my last week on the job. I know the place feels a little strange after dark, but honestly, you'll be fine." },
      { text: "First, the company wants me to read you the official greeting. It's a liability thing, so bear with me." },
      { text: "Welcome to Freddy Fazbear's Pizza, a magical place for kids and grown-ups alike. Fazbear Entertainment is not responsible for damage to property or person. Should damage or death be discovered, a missing person report will be filed within ninety days, or once the premises have been thoroughly cleaned and the carpets replaced." },
      { text: "Okay. That sounds a lot worse than it is. There's really nothing to worry about. The characters do get a bit quirky at night, but would I still be here if there was anything to be scared of?" },
      { text: "So, here's the thing. The animatronics are left in a free-roaming mode at night. If they stay still for too long their servos lock up, so they're allowed to wander. They used to walk around during the day too, until... well, there was an incident a few years back. Amazing what a person can live without, you know?" },
      { text: "The only real problem, as far as you and I are concerned, is that if they see you after hours they probably won't recognize you as a person. They'll see a metal endoskeleton without its costume on, and that's against the rules here. So they'll try to put you into a Freddy Fazbear suit. Forcefully." },
      { text: "Which wouldn't be so bad if the suits weren't packed with crossbeams and wires and mechanical parts, especially around the face. Nothing survives that, except maybe your eyes and teeth popping out the front of the mask." },
      { text: "Anyway. None of that happens if you watch the cameras and close the doors when you have to. Just remember the building has a very limited power budget at night. Doors, lights, cameras, they all eat into it. Run out of power and you're wide open." },
      { text: "Use the lights to check the doorways. Those are your blind spots. Keep an eye on the show stage, and if someone's missing, go find them. I'll talk to you tomorrow." },
    ],
    2: [
      { text: "Hello? Hello? Hey, you made it to night two. Nice. I won't keep you long, since things tend to get busier from here on." },
      { text: "Freddy and his friends get more active as the week goes on. It might be a good idea to glance at the cameras while I talk, just to make sure everyone is where they should be." },
      { text: "Interesting fact: Freddy himself doesn't move around much unless it's pitch dark. So if the power runs out... well, then you've got a problem." },
      { text: "Those lights are the only way to see past the doorway. If something's standing there, close the door. If nothing's there, don't waste the power." },
      { text: "One more thing. Check Pirate Cove once in a while. The character in there is... different. He gets restless if nobody's watching him. If he's out of his curtain, shut the left door, fast." },
      { text: "Alright. Good night, and good luck." },
    ],
    3: [
      { text: "Hello, hello? Hey, you're doing great! Most people don't last this long. I mean, not that they... they usually move on to other things. Anyway." },
      { text: "I don't have much to say tonight. Things start getting real on night three." },
      { text: "Here's an idea, though. If you get caught and want to avoid the whole suit thing, try to play dead. Go limp. Maybe they'll think you're an empty costume." },
      { text: "Then again, if they think you're an empty costume they might try to stuff a metal skeleton inside you. Not sure how that would go. ...Yeah, never mind, scratch that. Best not to get caught." },
      { text: "Alright, I'll leave you to it. Talk to you tomorrow." },
    ],
    4: [
      { text: "Hello? Hey... it's me again. Night four. Honestly, I didn't think I'd get to make this one." },
      { text: "Listen. Something's going on over here tonight. I might not be able to record a message for you tomorrow, so I'm going to say what I can now." },
      { fx: 'bang', text: "...That's the door. It's holding for now. I'm glad I made these recordings while I could." },
      { fx: 'bang', text: "If you ever get the chance, do me a favor and check the suits in the back room. Someone should look inside them. I'm going to try to wait it out until someone does." },
      { fx: 'bang', text: "Maybe it isn't as bad as it sounds. I always wondered what it was like inside one of those heads." },
      { fx: 'music', text: "...Do you hear that? That's... no. No, no, no..." },
      { fx: 'moan', text: '', dur: 2.2 },
      { fx: 'scream', text: '', dur: 1.6 },
    ],
    5: [{ fx: 'garble', text: '[unintelligible]', dur: 26 }],
  };

  P.Call = class {
    constructor(night) {
      this.script = P.SCRIPTS[night] || null;
      this.state = this.script ? 'wait' : 'done';
      this.t = 0; this.idx = 0; this.caption = ''; this.muted = false; this.sentenceEnd = 0; this.waitingSpeech = false;
      this.startDelay = 2.0;
      this.recording = null; this.handle = null; this.firedFx = 0; this.loading = false; this.ringEnd = 3.8; this.extraRings = 0;
      // a recorded call takes over if the files exist; otherwise the browser voice reads the script
      if (this.script && this.script[0].fx !== 'garble') {
        this.loading = true;
        A().loadCall(night).then(rec => { this.loading = false; if (rec && this.state !== 'done') this.recording = rec; });
      }
    }
    update(dt) {
      if (this.state === 'done') return;
      this.t += dt;
      if (this.state === 'wait') { if (this.t >= this.startDelay) { this.state = 'ring'; this.t = 0; A().ring(2); } return; }
      if (this.state === 'ring') {
        if (this.t >= this.ringEnd) {
          if (this.recording) { this.state = 'playing'; this.handle = A().playCall(this.recording.buffer, () => { if (this.state === 'playing') this.end(); }); A().callHandle = this.handle; }
          else if (this.loading && this.extraRings < 3) { this.extraRings++; this.ringEnd += 3.5; A().ring(2); }   // still downloading: let it ring
          else { this.state = 'talk'; this.idx = 0; this.say(); }
        }
        return;
      }
      if (this.state === 'playing') {
        const pos = A().now() - this.handle.start;
        const sents = this.recording.info.sentences;
        const cur = sents.find(s => pos >= s.start && pos < s.end);
        this.caption = cur ? cur.text : '';
        // scripted sound effects fire at their sentence start
        while (this.firedFx < sents.length && pos >= sents[this.firedFx].start) { const s = sents[this.firedFx++]; if (s.fx) this.fx(s.fx); }
        return;
      }
      if (this.state === 'talk' && !this.waitingSpeech) { if (this.t >= this.sentenceEnd) this.next(); }
    }
    get active() { return this.state === 'ring' || this.state === 'talk' || this.state === 'playing'; }
    say() {
      const s = this.script[this.idx];
      this.caption = s.text;
      if (s.fx) this.fx(s.fx);
      const words = s.text ? s.text.split(/\s+/).length : 0;
      if (s.text && A().speechOk && !this.muted) {
        this.waitingSpeech = true;
        const myIdx = this.idx;
        A().speak(s.text, () => { if (this.state === 'talk' && this.idx === myIdx && !this.muted) { this.waitingSpeech = false; this.sentenceEnd = this.t + 0.35; } });
        // fallback in case speech never finishes
        this.sentenceEnd = this.t + (s.dur || (1.5 + words * 0.5));
      } else {
        this.waitingSpeech = false;
        this.sentenceEnd = this.t + (s.dur || (1.0 + words * 0.36));
      }
    }
    next() {
      this.idx++;
      this.waitingSpeech = false;
      if (this.idx >= this.script.length) { this.end(); return; }
      this.say();
    }
    fx(name) {
      const a = A();
      if (name === 'bang') a.bang();
      else if (name === 'music') { a.musicStart(1.0, 0.12); this.musicStarted = true; }
      else if (name === 'moan') a.moan(0.35);
      else if (name === 'scream') { a.musicStop(); setTimeout(() => { if (!this.muted) a.scream(0.3); }, 300); }
      else if (name === 'garble') a.garble(26);
    }
    end() { this.state = 'done'; this.caption = ''; if (this.musicStarted) A().musicStop(); if (this.handle) { this.handle.stop(); this.handle = null; A().callHandle = null; } }
    mute() {
      if (!this.active) return;
      this.muted = true;
      if (this.handle) { this.handle.stop(); this.handle = null; A().callHandle = null; }
      A().stopSpeech();
      if (this.musicStarted) A().musicStop();
      this.state = 'done'; this.caption = '';
    }
    stop() { this.mute(); }
  };
})();
