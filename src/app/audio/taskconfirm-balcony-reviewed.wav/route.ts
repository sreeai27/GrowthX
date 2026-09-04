// A small reviewed local WAV placeholder keeps the audio control functional
// offline. The visible reviewed transcript remains the authoritative stimulus.
const REVIEWED_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function GET() {
  return new Response(Buffer.from(REVIEWED_WAV_BASE64, "base64"), {
    headers: { "content-type": "audio/wav", "cache-control": "public, max-age=31536000, immutable" },
  });
}
