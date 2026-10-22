#!/usr/bin/env python3
"""Generate the phone-call recordings for the game.

Engines:
  openai  - OpenAI speech (needs OPENAI_API_KEY in the environment). --model picks the model:
            gpt-4o-mini-tts (default, steerable via the TONE directions), tts-1 / tts-1-hd (not steerable),
            or a gpt-audio model (gpt-audio, gpt-audio-1.5: the large speech-capable chat model, driven
            through chat completions with audio output and told to read the text verbatim).
  kokoro  - local Kokoro-82M (needs the `kokoro` and `soundfile` packages)

Examples:
  python3 tools/generate_calls.py --engine openai --sample                         # Night 1 opening, several voices -> tools/out/
  python3 tools/generate_calls.py --engine openai --sample --voice cedar,marin      # pick the sample voices
  python3 tools/generate_calls.py --engine openai --model gpt-audio-1.5 --sample --voice cedar
  python3 tools/generate_calls.py --engine openai --voice ash --all                # all calls -> audio/callN.mp3 + audio/callN.json
  python3 tools/generate_calls.py --engine kokoro --voice am_michael --all

Output per call: audio/callN.mp3 (phone-filtered, mono) and audio/callN.json with per-sentence
start/end times so the game can show captions in sync. Night 5 is garbled in-game and is skipped.
"""
import argparse, base64, json, os, re, subprocess, sys, tempfile, wave, struct, urllib.request, urllib.error

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
DEFAULT_MODEL = {'openai': 'gpt-4o-mini-tts', 'kokoro': 'hexgrad/Kokoro-82M'}


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
def _openai_post(path, body, key):
    req = urllib.request.Request('https://api.openai.com/v1/' + path, data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f'OpenAI API error {e.code} on {path}: {e.read()[:500].decode(errors="replace")}')


def _norm(s):
    return re.sub(r'[^a-z0-9 ]+', '', s.lower().replace('-', ' ')).split()


def tts_openai(text, voice, instructions, out_wav, model=None):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY is not set in this environment')
    model = model or DEFAULT_MODEL['openai']
    if model.startswith('gpt-audio'):
        # The large speech-capable chat model: ask it to perform the line verbatim. It is an LLM, so check
        # its own transcript against the script and retry if it paraphrased.
        system = ('You are a voice actor recording lines for a game. Read the user\'s text aloud exactly as written, '
                  'word for word: no additions, no greeting, no commentary, do not answer it. Performance direction: ' + instructions)
        body = {'model': model, 'modalities': ['text', 'audio'], 'audio': {'voice': voice, 'format': 'wav'},
                'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': text}]}
        for attempt in range(3):
            resp = json.loads(_openai_post('chat/completions', body, key))
            audio = (resp.get('choices') or [{}])[0].get('message', {}).get('audio') or {}
            if not audio.get('data'):
                print('  ! no audio in response, retrying', flush=True); continue
            said = audio.get('transcript', '')
            if _norm(said) == _norm(text) or attempt == 2:
                if _norm(said) != _norm(text):
                    print(f'  ! transcript differs from script after 3 tries:\n    script: {text}\n    said:   {said}', flush=True)
                data = base64.b64decode(audio['data'])
                break
            print(f'  ! model paraphrased, retrying: {said!r}', flush=True)
    else:
        body = {'model': model, 'voice': voice, 'input': text, 'response_format': 'wav'}
        if model.startswith('gpt-4o-mini-tts'):      # tts-1 / tts-1-hd do not take directions
            body['instructions'] = instructions
        data = _openai_post('audio/speech', body, key)
    with open(out_wav, 'wb') as f:
        f.write(data)
    resample_to(out_wav, SR)


_kokoro = None
def tts_kokoro(text, voice, instructions, out_wav, model=None):
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


def render_call(engine, voice, night, sentences, out_base, tone, model=None):
    """Generate each sentence, join with gaps, return caption timings."""
    tts = ENGINES[engine]
    model = model or DEFAULT_MODEL[engine]
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
        tts(text, voice, tone, wav, model)
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
    return {'night': night, 'engine': engine, 'model': model, 'voice': voice, 'duration': round(t, 3), 'sentences': timings}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', choices=ENGINES.keys(), default='openai')
    ap.add_argument('--voice', help='voice name (openai: ash, echo, onyx, verse, cedar, marin, ballad, ...; kokoro: am_michael, ...). '
                                    'With --sample, a comma-separated list renders several.')
    ap.add_argument('--model', help='openai model: gpt-4o-mini-tts (default), tts-1-hd, gpt-audio-1.5, ...')
    ap.add_argument('--sample', action='store_true', help='Night 1 opening in several voices -> tools/out/')
    ap.add_argument('--all', action='store_true', help='render every call -> audio/')
    ap.add_argument('--night', type=int, help='render one night -> audio/')
    args = ap.parse_args()
    scripts = load_scripts()
    model = args.model or DEFAULT_MODEL[args.engine]
    if args.sample:
        out_dir = os.path.join(ROOT, 'tools', 'out'); os.makedirs(out_dir, exist_ok=True)
        voices = args.voice.split(',') if args.voice else SAMPLE_VOICES[args.engine]
        sample = scripts['1'][:3]
        tag = args.engine if model == DEFAULT_MODEL[args.engine] else f'{args.engine}_{model}'
        for v in voices:
            print('sample', model, 'voice', v)
            info = render_call(args.engine, v, 1, sample, os.path.join(out_dir, f'sample_{tag}_{v}'), TONE[1], model)
            print('  ->', os.path.join(out_dir, f'sample_{tag}_{v}.mp3'), f'{info["duration"]:.1f}s')
        return
    if not args.voice:
        sys.exit('--voice is required for --all / --night')
    os.makedirs(OUT_AUDIO, exist_ok=True)
    nights = [args.night] if args.night else [1, 2, 3, 4]
    for n in nights:
        sents = scripts[str(n)]
        if not any(s.get('text') for s in sents) or sents[0].get('fx') == 'garble':
            print('night', n, 'is garbled in-game; skipping'); continue
        print('night', n, model, 'voice', args.voice)
        info = render_call(args.engine, args.voice, n, sents, os.path.join(OUT_AUDIO, f'call{n}'), TONE.get(n, TONE[1]), model)
        with open(os.path.join(OUT_AUDIO, f'call{n}.json'), 'w') as f:
            json.dump(info, f, indent=1)
        print('  wrote', os.path.join(OUT_AUDIO, f'call{n}.mp3'), f'{info["duration"]:.1f}s')


if __name__ == '__main__':
    main()
