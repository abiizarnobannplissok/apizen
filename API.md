# API Documentation

## Endpoint

```
POST /v1/chat/completions
```

## Contoh CURL

```bash
curl -X POST "https://apizen-iota.vercel.app/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Response

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
    "completion_tokens": 7,
    "total_tokens": 8
  }
}
```
