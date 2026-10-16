import os
import sys
import io
import wave
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
import numpy as np
import pyaudiowpatch as pyaudio

# Ensure Windows console supports UTF-8 safely
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Load environment variables
env_file = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip("'\"")

GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
NODE_BRIDGE_URL = 'http://127.0.0.1:5056/caller_speech'

# Shared state across all device worker threads
state = {
    'call_active': True,
    'ai_speaking_until': 0.0,
    'last_dispatch_time': 0.0
}
state_lock = threading.Lock()

class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress HTTP access logging

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else '{}'
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if self.path == '/ai_speaking':
            duration = float(data.get('duration', 5.0))
            with state_lock:
                if duration <= 0.05:
                    # Clearance buffer so speaker tail doesn't bleed into loopback
                    state['ai_speaking_until'] = time.time() + 0.35
                    print("[WASAPI Loopback] AI finished speaking -> Unlocked after acoustic clearance.")
                else:
                    state['ai_speaking_until'] = time.time() + duration + 0.3
                    print(f"[WASAPI Loopback] AI speaking lock engaged for {duration:.1f}s.")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

        elif self.path == '/call_status':
            with state_lock:
                state['call_active'] = bool(data.get('active', True))
                status_text = "ACTIVE" if state['call_active'] else "IDLE"
            print(f"[WASAPI Loopback] Call state changed to: {status_text}")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status": "running"}')

def start_control_server():
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(('127.0.0.1', 5057), ControlHandler)
    server.serve_forever()

BILINGUAL_PROMPT = (
    "Hello, namaste! How can I help you? "
    "नमस्ते, क्या आप मेरी मदद कर सकते हैं? "
    "अपॉइंटमेंट, डॉक्टर, तबियत, मदद, सलाह, जानकारी, दांत, दर्द, क्लिनिक।"
)

HALLUCINATION_PHRASES = {
    'thank you', 'thank you.', 'thanks', 'thanks.', 'thank you very much.', 'thank you so much.',
    'you', 'bye', 'bye.', 'goodbye', 'subscribe', 'subtitles by', 'amara.org', '.', '..', '...',
    'watching.', 'thanks for watching.', 'watching', 'thank you!', 'thank you very much!',
    'now, we can deploy that by the islam.', 'peace. i\'ll give you a little.', 'you laugh at the part of the family.'
}

def transcribe_with_groq(wav_bytes):
    if not GROQ_API_KEY:
        return ""
    try:
        data = {
            "model": "whisper-large-v3-turbo",
            "temperature": "0.0",
            "prompt": BILINGUAL_PROMPT
        }
        res = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            files={"file": ("caller.wav", io.BytesIO(wav_bytes), "audio/wav")},
            data=data,
            timeout=8.0
        )
        if res.status_code == 200:
            text = res.json().get("text", "").strip()
            lower = text.lower()
            clean_lower = lower.strip('.!? ')
            # Filter non-speech hallucinations & subtitle credits
            if (
                clean_lower in HALLUCINATION_PHRASES or
                lower in HALLUCINATION_PHRASES or
                len(text) < 2 or
                any(u'\u0400' <= c <= u'\u04FF' for c in text)  # Filter random Cyrillic
            ):
                return ""
            return text
        else:
            print(f"[Whisper Error] HTTP {res.status_code}: {res.text}")
            return ""
    except Exception as e:
        print(f"[Whisper Exception] {e}")
        return ""

def process_speech_chunk(frames, channels, sample_rate, dev_name):
    try:
        raw_bytes = b"".join(frames)
        arr = np.frombuffer(raw_bytes, dtype=np.int16)
        peak = int(np.max(np.abs(arr)))
        mean_amp = float(np.mean(np.abs(arr)))

        # Require real human voice energy (real speech over WhatsApp call has peak >= 150)
        if peak < 150 or mean_amp < 25:
            return

        now = time.time()
        with state_lock:
            # Per-device / global debounce of 0.4s
            if now - state.get('last_whisper_call', 0) < 0.4:
                return
            state['last_whisper_call'] = now

        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(raw_bytes)
        wav_io.seek(0)
        wav_bytes = wav_io.getvalue()

        t0 = time.time()
        transcript = transcribe_with_groq(wav_bytes)
        if transcript:
            dur = (time.time() - t0) * 1000
            safe_text = transcript.encode('ascii', errors='replace').decode('ascii')
            print(f"[Groq Whisper Transcript ({dev_name})]: \"{safe_text}\" ({dur:.0f}ms)")

            # Deduplicate rapid duplicate triggers across devices
            now = time.time()
            with state_lock:
                if transcript.lower() == state.get('last_sent_text', '') and (now - state.get('last_dispatch_time', 0) < 2.0):
                    return
                state['last_sent_text'] = transcript.lower()
                state['last_dispatch_time'] = now

            # Dispatch to Node.js WhatsApp caller bridge
            try:
                requests.post(NODE_BRIDGE_URL, json={"text": transcript, "source": dev_name}, timeout=3.0)
            except Exception as e:
                print(f"[Dispatch Error] {e}")
    except Exception as e:
        print(f"[Process Error] {e}")

def audio_worker(p, dev, is_loopback=True):
    dev_name = dev["name"]
    channels = int(dev["maxInputChannels"])
    sample_rate = int(dev["defaultSampleRate"])

    try:
        stream = p.open(
            format=pyaudio.paInt16,
            channels=channels,
            rate=sample_rate,
            input=True,
            input_device_index=dev["index"],
            frames_per_buffer=1024
        )
        print(f"[Audio Worker Active] {dev_name} ({sample_rate}Hz, {channels}ch)")
    except Exception as e:
        print(f"[Audio Worker Failed] {dev_name}: {e}")
        return

    speech_frames = []
    is_speaking = False
    silence_start = None
    speech_start_time = 0

    while True:
        try:
            # Non-blocking check: guarantees audio thread never hangs on inactive virtual drivers
            if stream.get_read_available() < 1024:
                time.sleep(0.005)
                continue

            raw_data = stream.read(1024, exception_on_overflow=False)
            if not raw_data:
                continue
        except Exception:
            time.sleep(0.01)
            continue

        now = time.time()
        with state_lock:
            speaking_until = state['ai_speaking_until']

        # If AI is currently speaking, ignore faint acoustic bleed (prevents self-echo)
        if now < speaking_until:
            if speech_frames:
                speech_frames = []
            is_speaking = False
            silence_start = None
            continue

        audio_chunk = np.frombuffer(raw_data, dtype=np.int16)
        max_amp = int(np.max(np.abs(audio_chunk)))

        # VAD threshold: 80 for loopback / mic (ignores room hum & digital floor while reliably picking up caller voice)
        thresh = 80
        if max_amp > thresh:
            if not is_speaking:
                is_speaking = True
                speech_start_time = now
                print(f"[Caller Speech Detected] {dev_name} (Amp: {max_amp})")
            silence_start = None
            speech_frames.append(raw_data)

            # Flush after 5.0 seconds of continuous speech
            if now - speech_start_time > 5.0 and len(speech_frames) >= 20:
                is_speaking = False
                frames_to_send = list(speech_frames)
                speech_frames = []
                threading.Thread(
                    target=process_speech_chunk,
                    args=(frames_to_send, channels, sample_rate, dev_name),
                    daemon=True
                ).start()

        else:
            # Silence frame
            if is_speaking:
                speech_frames.append(raw_data)
                if silence_start is None:
                    silence_start = now
                elif now - silence_start > 0.45:  # 450ms natural spoken cadence pause
                    is_speaking = False
                    silence_start = None
                    frames_to_send = list(speech_frames)
                    speech_frames = []
                    # Must have at least ~340ms (16 chunks) of sustained voice activity
                    if len(frames_to_send) >= 16:
                        threading.Thread(
                            target=process_speech_chunk,
                            args=(frames_to_send, channels, sample_rate, dev_name),
                            daemon=True
                        ).start()
            else:
                # Discard stale buffer
                if len(speech_frames) > 5:
                    speech_frames = []

def main():
    print("================================================================")
    print(" Inspirus Voice AI -- Multi-Device Windows Audio Tap")
    print(" Engine: PyAudioWPatch (Direct Driver Tap: Loopback + Mic)")
    print(" STT: Groq whisper-large-v3-turbo (Sub-200ms Neural)")
    print(" Control Server: http://127.0.0.1:5057")
    print("================================================================\n")

    # Start HTTP control server in background thread
    t = threading.Thread(target=start_control_server, daemon=True)
    t.start()

    p = pyaudio.PyAudio()
    try:
        # 1. Listen to ALL loopback outputs (Realtek, ASUS Utility, soundcore)
        loopback_devs = list(p.get_loopback_device_info_generator())
        if not loopback_devs:
            print("[WASAPI Error] No loopback audio devices found on this system!")
            return

        print(f"Discovered {len(loopback_devs)} Windows Audio Loopback Device(s):")
        for dev in loopback_devs:
            print(f" -> [{dev['index']}] {dev['name']}")

        for dev in loopback_devs:
            t = threading.Thread(target=audio_worker, args=(p, dev, True), daemon=True)
            t.start()

        # 2. ALSO listen to default microphone as fallback
        try:
            default_mic = p.get_default_input_device_info()
            print(f" -> Default Microphone: [{default_mic['index']}] {default_mic['name']}")
            t_mic = threading.Thread(target=audio_worker, args=(p, default_mic, False), daemon=True)
            t_mic.start()
        except Exception as e:
            print(f"[Mic Worker Warning]: {e}")

        print("\nAll Loopback + Microphone Workers actively listening for caller speech...\n")

        # Keep main thread alive
        while True:
            time.sleep(1)

    finally:
        p.terminate()

if __name__ == '__main__':
    main()
