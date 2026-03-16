// APIZen - Gemini OpenAI Wrapper
import { NextRequest, NextResponse } from 'next/server';

const WRAPPER_API_URL = 'https://api.zenzxz.my.id/ai/gemini';
const API_KEY = process.env.API_KEY || 'a';

function chunkText(text: string, chunkSize: number = 20): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const word of words) {
    if ((currentChunk + ' ' + word).trim().length >= chunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk = (currentChunk + ' ' + word).trim();
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-Api-Key');
  
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const providedKey = bearerToken || apiKeyHeader;
  
  if (API_KEY && (!providedKey || providedKey !== API_KEY)) {
    return NextResponse.json(
      {
        error: {
          message: 'Incorrect API key provided',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      },
      { status: 401 }
    );
  }
  
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      const text = await request.text();
      console.error('JSON parse error. Raw body:', text);
      return NextResponse.json(
        {
          error: {
            message: 'Invalid JSON in request body',
            type: 'invalid_request_error',
            code: 'json_parse_error'
          }
        },
        { status: 400 }
      );
    }
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid request body',
            type: 'invalid_request_error',
            code: 'invalid_request'
          }
        },
        { status: 400 }
      );
    }
    
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        {
          error: {
            message: 'messages is required',
            type: 'invalid_request_error',
            code: 'missing_required_field'
          }
        },
        { status: 400 }
      );
    }
    
    const { messages, model, stream, temperature, top_p, ...extra } = body;
    
    const lastMessage = messages?.[messages.length - 1];
    const systemMessage = messages?.find((m: any) => m.role === 'system' || m.role === 'developer');
    
    const q = lastMessage?.content || '';
    
    if (!q || q.trim() === '') {
      return NextResponse.json(
        {
          error: {
            message: 'message content is required',
            type: 'invalid_request_error',
            code: 'missing_required_field'
          }
        },
        { status: 400 }
      );
    }
    
    const instruction = systemMessage?.content || extra.instruction || '';
    const url = extra.url || '';
    
    const targetModel = model || extra.model || 'gemini-3-flash-preview';
    
    const params = new URLSearchParams({
      q,
      model: targetModel,
    });
    
    if (instruction) {
      params.append('instruction', instruction);
    }
    
    if (url) {
      params.append('url', url);
    }
    
    const response = await fetch(`${WRAPPER_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!data.status) {
      return NextResponse.json(
        { error: { message: data.result || 'API error', type: 'api_error' } },
        { status: 500 }
      );
    }
    
    const content = data.result;
    
    if (!content) {
      return NextResponse.json(
        { error: { message: 'Empty response from API', type: 'api_error' } },
        { status: 500 }
      );
    }
    
    const created = Math.floor(Date.now() / 1000);
    const completionId = `chatcmpl-${Date.now()}`;
    
    if (stream) {
      const encoder = new TextEncoder();
      const responseStream = new ReadableStream({
        async start(controller) {
          // Send first chunk with content
          if (content && content.length > 0) {
            const chunks = chunkText(content, 25);
            
            for (let i = 0; i < chunks.length; i++) {
              const chunkData = {
                id: completionId,
                object: 'chat.completion.chunk',
                created,
                model: targetModel,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: chunks[i] + (i < chunks.length - 1 ? ' ' : ''),
                    },
                    finish_reason: null,
                  },
                ],
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          
          // Send final chunk with finish_reason
          const finalChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: targetModel,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      
      return new NextResponse(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    return NextResponse.json({
      id: completionId,
      object: 'chat.completion',
      created,
      model: targetModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: q.split(/\s+/).length,
        completion_tokens: content?.split(/\s+/).length || 0,
        total_tokens: (q.split(/\s+/).length + (content?.split(/\s+/).length || 0)),
      },
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: { message: error.message || 'Internal server error', type: 'invalid_request_error' } },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: { message: 'Method not allowed. Use POST.', type: 'invalid_request_error' } },
    { status: 405 }
  );
}
