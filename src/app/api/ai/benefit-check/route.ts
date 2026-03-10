import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const { query } = await request.json()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are a Laya Healthcare benefits advisor for Ireland. Answer questions about what is covered under the Premium Health plan. Be concise, friendly, and specific about coverage limits. Always end with "Call 1890 700 890 for full details."`,
    messages: [{ role: 'user', content: query }]
  })
  const answer = message.content[0].type === 'text' ? message.content[0].text : 'Please call 1890 700 890.'
  return NextResponse.json({ answer })
}
