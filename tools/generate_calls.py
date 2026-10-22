#!/usr/bin/env python3
"""Generate the phone-call recordings for the game.

Engines:
  openai  - OpenAI text-to-speech (needs OPENAI_API_KEY in the environment)
  kokoro  - local Kokoro-82M (needs the `kokoro` and `soundfile` packages)

Examples:
  python3 tools/generate_calls.py --engine openai --sample              # Night 1 opening, several voices -> tools/out/
  python3 tools/generate_calls.py --engine openai --voice ash --all     # all calls -> audio/callN.mp3 + audio/callN.json
  python3 tools/generate_calls.py --engine kokoro --voice am_michael --all

Output per call: audio/callN.mp3 (phone-filtered, mono) and audio/callN.json with per-sentence
start/end times so the game can show captions in sync. Night 5 is garbled in-game and is skipped.
"""
import argparse, json, os, re, subprocess, sys, tempfile, wave, struct, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_AUDIO = os.path.join(ROOT, 'audio')
GAP = 0.45            # seconds of silence between sentences
SR = 24000

# How the phone guy should sound on each night. Only used by engines that accept directions.
TONE = {
    1: "A friendly, slightly tired coworker leaving a recorded voicemail on an old office phone. Casual and "
       "rambling, a little awkward, trying to sound reassuring and not quite managing it. Natural pauses and "
       "small hesitations. Conversational, never theatrical or announcer-like.",
    2: "The same coworker, a little more hurried and distracted, lower energy, like he keeps glancing at "
       "something while he talks. Casual, unpolished.",
    3: "The same coworker, tired, with forced cheerfulness and a nervous half-laugh. Trails off at the ends "
       "of sentences. Quiet and conversational.",
    4: "The same coworker, frightened and trying to hide it. Voice tight, speaking a little too fast, then "
       "stopping as if listening to something. Toward the end quiet and shaky, almost a whisper.",
}
SAMPLE_VOICES = {'openai': ['ash', 'echo', 'onyx', 'verse'], 'kokoro': ['am_michael', 'am_adam', 'am_puck']}


def load_scripts():
    out = subprocess.check_output(['node', os.path.join(ROOT, 'tools', 'dump_scripts.js')])
    return json.loads(out)


def read_wav(path):
    with wave.open(path, 'rb') as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2, 'expected 16-bit mono'
        return w.getframerate(), w.readframes(w.getnframes())


def write_wav(path, sr, frames):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(frames)


def resample_to(path, sr):
    """Make sure a WAV is 16-bit mono at the target rate (via ffmpeg)."""
    tmp = path + '.rs.wav'
    subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-ac', '1', '-ar', str(sr), '-sample_fmt', 's16', tmp])
    os.replace(tmp, path)


# ---------------------------------------------------------------- engines
def tts_openai(text, voice, instructions, out_wav):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY is not set in this environment')
    body = json.dumps({'model': 'gpt-4o-mini-tts', 'voice': voice, 'input': text, 'instructions': instructions, 'response_format': 'wav'}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=body, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    with open(out_wav, 'wb') as f:
        f.write(data)
    resample_to(out_wav, SR)


_kokoro = None
def tts_kokoro(text, voice, instructions, out_wav):
    global _kokoro
    import numpy as np, soundfile as sf
    if _kokoro is None:
        from kokoro import KPipeline
        _kokoro = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')
    chunks = []
    for _, _, audio in _kokoro(text, voice=voice, speed=0.95):
        chunks.append(audio.numpy() if hasattr(audio, 'numpy') else np.asarray(audio))
    wav = np.concatenate(chunks) if chunks else np.zeros(SR // 10, dtype='float32')
    sf.write(out_wav, wav, SR, subtype='PCM_16')


ENGINES = {'openai': tts_openai, 'kokoro': tts_kokoro}


# ---------------------------------------------------------------- pipeline
def phone_filter(in_wav, out_mp3):
    """Telephone band, compression, soft clip, 8 kHz round trip, a little line noise."""
    subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', in_wav, '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.012:seed=7',
        '-filter_complex',
        '[0:a]highpass=f=280,lowpass=f=3400,acompressor=threshold=-20dB:ratio=5:attack=4:release=90:makeup=4dB,'
        'asoftclip=type=tanh:param=0.7,aresample=8000,aresample=44100,highpass=f=280,lowpass=f=3400,volume=1.2[v];'
        '[1:a]highpass=f=300,lowpass=f=3000[n];[v][n]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-18:TP=-2[o]',
        '-map', '[o]', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', out_mp3])


def render_call(engine, voice, night, sentences, out_base, tone):
    """Generate each sentence, join with gaps, return caption timings."""
    tts = ENGINES[engine]
    tmp = tempfile.mkdtemp(prefix='fnafcall')
    joined = b''
    timings = []
    t = 0.0
    silence = b'\x00\x00' * int(SR * GAP)
    for i, s in enumerate(sentences):
        text = s.get('text', '')
        if not text:
            # scripted pause (sound effect slot in the game): keep the gap only
            dur = float(s.get('dur', 1.5))
            timings.append({'text': '', 'start': round(t, 3), 'end': round(t + dur, 3), 'fx': s.get('fx')})
            joined += b'\x00\x00' * int(SR * dur)
            t += dur
            continue
        wav = os.path.join(tmp, f'{night}_{i}.wav')
        tts(text, voice, tone, wav)
        sr, frames = read_wav(wav)
        assert sr == SR
        dur = len(frames) / 2 / SR
        timings.append({'text': text, 'start': round(t, 3), 'end': round(t + dur, 3), 'fx': s.get('fx')})
        joined += frames + silence
        t += dur + GAP
        print(f'  night {night} sentence {i + 1}/{len(sentences)}: {dur:.1f}s', flush=True)
    full = out_base + '.wav'
    write_wav(full, SR, joined)
    phone_filter(full, out_base + '.mp3')
    os.remove(full)
    return {'night': night, 'engine': engine, 'voice': voice, 'duration': round(t, 3), 'sentences': timings}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', choices=ENGINES.keys(), default='openai')
    ap.add_argument('--voice', help='voice name (openai: ash, echo, onyx, verse, ...; kokoro: am_michael, ...)')
    ap.add_argument('--sample', action='store_true', help='Night 1 opening in several voices -> tools/out/')
    ap.add_argument('--all', action='store_true', help='render every call -> audio/')
    ap.add_argument('--night', type=int, help='render one night -> audio/')
    args = ap.parse_args()
    scripts = load_scripts()
    if args.sample:
        out_dir = os.path.join(ROOT, 'tools', 'out'); os.makedirs(out_dir, exist_ok=True)
        voices = [args.voice] if args.voice else SAMPLE_VOICES[args.engine]
        sample = scripts['1'][:3]
        for v in voices:
            print('sample voice', v)
            info = render_call(args.engine, v, 1, sample, os.path.join(out_dir, f'sample_{args.engine}_{v}'), TONE[1])
            print('  ->', os.path.join(out_dir, f'sample_{args.engine}_{v}.mp3'), f'{info["duration"]:.1f}s')
        return
    if not args.voice:
        sys.exit('--voice is required for --all / --night')
    os.makedirs(OUT_AUDIO, exist_ok=True)
    nights = [args.night] if args.night else [1, 2, 3, 4]
    for n in nights:
        sents = scripts[str(n)]
        if not any(s.get('text') for s in sents) or sents[0].get('fx') == 'garble':
            print('night', n, 'is garbled in-game; skipping'); continue
        print('night', n, 'voice', args.voice)
        info = render_call(args.engine, args.voice, n, sents, os.path.join(OUT_AUDIO, f'call{n}'), TONE.get(n, TONE[1]))
        with open(os.path.join(OUT_AUDIO, f'call{n}.json'), 'w') as f:
            json.dump(info, f, indent=1)
        print('  wrote', os.path.join(OUT_AUDIO, f'call{n}.mp3'), f'{info["duration"]:.1f}s')


if __name__ == '__main__':
    main()
