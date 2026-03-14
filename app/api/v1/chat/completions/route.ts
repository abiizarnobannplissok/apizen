import { NextRequest, NextResponse } from 'next/server';

const WRAPPER_API_URL = 'https://api.zenzxz.my.id/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { messages, model, ...extra } = body;
    
    const lastMessage = messages?.[messages.length - 1];
    const systemMessage = messages?.find((m: any) => m.role === 'system');
    
    const q = lastMessage?.content || '';
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
    
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: targetModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.result,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: q.split(/\s+/).length,
        completion_tokens: data.result?.split(/\s+/).length || 0,
        total_tokens: (q.split(/\s+/).length + (data.result?.split(/\s+/).length || 0)),
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
