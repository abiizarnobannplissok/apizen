# Gemini OpenAI Wrapper API

API wrapper yang mengintegrasikan `https://api.zenzxz.my.id/ai/gemini` menjadi OpenAI-compatible endpoint.

## Deploy ke Vercel

```bash
npm install
vercel deploy
```

## Endpoint

```
POST /api/v1/chat/completions
```

## Format Request (OpenAI-compatible)

```json
{
  "model": "gemini-3-flash-preview",
  "messages": [
    { "role": "system", "content": "Act as Shiroko" },
    { "role": "user", "content": "Hello" }
  ],
  "url": "https://example.com/image.jpg"
}
```

## Parameter

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `model` | string | No | Model target (default: `gemini-3-flash-preview`) |
| `messages` | array | Yes | Array pesan dengan role `system`, `user`, `assistant` |
| `url` | string | No | URL gambar/file untuk dianalisis |

## Response Format

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gemini-3-flash-preview",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1,
    "completion_tokens": 6,
    "total_tokens": 7
  }
}
```

## Contoh CURL

```bash
curl -X POST "https://your-project.vercel.app/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Mapping ke API Asli

| OpenAI Parameter | Wrapper API Parameter |
|------------------|----------------------|
| `messages[last].content` | `q` |
| `messages[role=system].content` | `instruction` |
| `model` | `model` |
| `url` | `url` |
