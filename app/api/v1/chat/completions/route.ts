// APIZen - Gemini OpenAI Wrapper
import { NextRequest, NextResponse } from 'next/server';

const WRAPPER_API_URL = 'https://api.zenzxz.my.id/ai/gemini';
const API_KEY = process.env.API_KEY || 'a';

// Check if authentication should be bypassed (when API_KEY is empty or disabled)
const AUTH_DISABLED = !API_KEY || API_KEY === '';

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

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  'Access-Control-Max-Age': '86400',
};

// Helper to create consistent error responses
function errorResponse(message: string, type: string, code: string, status: number) {
  return NextResponse.json(
    { error: { message, type, code } },
    { status, headers: corsHeaders }
  );
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-Api-Key');
  const acceptHeader = request.headers.get('accept');
  
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const providedKey = bearerToken || apiKeyHeader;
  
  // Check if client prefers JSON (not SSE streaming)
  const prefersJSON = acceptHeader?.includes('application/json') || !acceptHeader?.includes('text/event-stream');
  
  // Authentication check - skip if AUTH_DISABLED
  if (!AUTH_DISABLED && (!providedKey || providedKey !== API_KEY)) {
    return errorResponse(
      'Incorrect API key provided',
      'authentication_error',
      'invalid_api_key',
      401
    );
  }
  
  try {
    let body;
    let rawBody = '';
    
    // Clone request to allow reading body multiple times
    const clonedRequest = request.clone();
    
    try {
      body = await request.json();
    } catch (parseError) {
      try {
        rawBody = await clonedRequest.text();
      } catch {
        rawBody = 'Unable to read body';
      }
      console.error('JSON parse error. Raw body:', rawBody.substring(0, 500));
      return errorResponse(
        'Invalid JSON in request body',
        'invalid_request_error',
        'json_parse_error',
        400
      );
    }
    
    // Check if streaming is explicitly requested
    const shouldStream = body?.stream === true;
    
    if (!body || typeof body !== 'object') {
      return errorResponse(
        'Invalid request body',
        'invalid_request_error',
        'invalid_request',
        400
      );
    }
    
    if (!body.messages || !Array.isArray(body.messages)) {
      return errorResponse(
        'messages is required',
        'invalid_request_error',
        'missing_required_field',
        400
      );
    }
    
    const { messages, model, stream, temperature, top_p, ...extra } = body;
    
    // Always use non-streaming for reliability (upstream API doesn't support streaming well)
    const isStreaming = false;
    
    const lastMessage = messages?.[messages.length - 1];
    const systemMessage = messages?.find((m: any) => m.role === 'system' || m.role === 'developer');
    
    let q = lastMessage?.content || '';
    
    // Truncate query if too long (URL has ~2000 char limit)
    if (q.length > 1500) {
      q = q.substring(0, 1500) + '...';
    }
    
    if (!q || q.trim() === '') {
      return NextResponse.json(
        {
          error: {
            message: 'message content is required',
            type: 'invalid_request_error',
            code: 'missing_required_field'
          }
        },
        { status: 400, headers: corsHeaders }
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
      params.append('instruction', instruction.substring(0, 500));
    }
    
    let response;
    try {
      response = await fetch(`${WRAPPER_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch (networkError: any) {
      console.error('Network error calling upstream API:', networkError.message);
      return errorResponse(
        'Failed to connect to upstream API: ' + networkError.message,
        'api_error',
        'network_error',
        502
      );
    }
    
    // Check if the response is OK
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch {
        errorText = 'Unknown error';
      }
      console.error('Upstream API error:', response.status, errorText);
      // Make sure we return valid JSON even for error cases
      return NextResponse.json(
        { error: { message: `Upstream API error (${response.status})`, type: 'api_error', code: 'upstream_error' } },
        { status: 502, headers: corsHeaders }
      );
    }
    
    let data;
    try {
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.error('Empty response from upstream API');
        return errorResponse(
          'Empty response from upstream API',
          'api_error',
          'empty_response',
          502
        );
      }
      data = JSON.parse(text);
    } catch (parseError: any) {
      console.error('Failed to parse upstream API response:', parseError.message);
      return errorResponse(
        'Invalid JSON response from upstream API',
        'api_error',
        'parse_error',
        502
      );
    }
    
    if (!data || typeof data !== 'object') {
      return errorResponse(
        'Invalid response format from upstream API',
        'api_error',
        'invalid_response',
        502
      );
    }
    
    if (!data.status) {
      return errorResponse(
        data.message || data.result || 'API error',
        'api_error',
        'upstream_error',
        500
      );
    }
    
    const content = data.result;
    
    if (!content || (typeof content === 'string' && content.trim() === '')) {
      return errorResponse(
        'Empty response from API',
        'api_error',
        'empty_response',
        500
      );
    }
    
    const created = Math.floor(Date.now() / 1000);
    const completionId = `chatcmpl-${Date.now()}`;
    
    // Use q (already truncated) for token counting
    const tokenCountQ = q.split(/\s+/).length;
    
    if (isStreaming) {
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
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...corsHeaders,
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
        prompt_tokens: tokenCountQ,
        completion_tokens: content?.split(/\s+/).length || 0,
        total_tokens: (tokenCountQ + (content?.split(/\s+/).length || 0)),
      },
    }, { headers: corsHeaders });
    
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return errorResponse(
      error.message || 'Internal server error',
      'internal_error',
      'server_error',
      500
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: { message: 'Method not allowed. Use POST.', type: 'invalid_request_error' } },
    { status: 405, headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
