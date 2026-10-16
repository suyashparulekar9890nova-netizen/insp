import sys
import os
import io
import urllib.parse
import asyncio
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import edge_tts

# In-memory cache for ultra-low latency playback
AUDIO_CACHE = {}

class TTSHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path not in ["/tts", "/api/tts", "/health"]:
            self.send_response(404)
            self.end_headers()
            return

        if url.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","engine":"edge-tts"}')
            return

        params = urllib.parse.parse_qs(url.query)
        text = params.get("text", [""])[0].strip()
        voice = params.get("voice", ["hi-IN-MadhurNeural"])[0].strip()
        print(f"[TTS Server] Request received for voice '{voice}' ({len(text)} chars): {text[:60]}", flush=True)

        if not text:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Missing text parameter")
            return

        # Check in-memory cache
        cache_key = f"{voice}:{text}"
        if cache_key in AUDIO_CACHE:
            audio_data = AUDIO_CACHE[cache_key]
        else:
            async def generate():
                communicate = edge_tts.Communicate(text, voice)
                buf = io.BytesIO()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        buf.write(chunk["data"])
                return buf.getvalue()

            try:
                audio_data = asyncio.run(generate())
                # Cache up to 100 entries
                if len(AUDIO_CACHE) > 100:
                    AUDIO_CACHE.clear()
                AUDIO_CACHE[cache_key] = audio_data
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
                return

        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio_data)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "public, max-age=3600")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        try:
            self.wfile.write(audio_data)
        except Exception:
            pass

    def log_message(self, format, *args):
        # Quiet logger
        pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5055
    server = ThreadingHTTPServer(("127.0.0.1", port), TTSHandler)
    print(f"TTS Server listening on http://127.0.0.1:{port}/tts", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
