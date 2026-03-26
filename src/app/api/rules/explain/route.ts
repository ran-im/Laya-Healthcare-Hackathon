import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { decision, rules } = await request.json()

    const ruleText = (rules || [])
      .map((r: any) =>
        `- ${r.rule_id} | ${r.rule_name} | ${r.outcome} | ${r.category} | ${r.message}`
      )
      .join('\n')

    const prompt = `
You are a healthcare insurance claims rule explainer.

Important rules:
- Do NOT change the decision.
- Do NOT invent new policy rules.
- Do NOT recommend a different outcome.
- Only explain the provided rule-engine output in clear English for an assessor.

Final decision: ${decision}

Triggered rules:
${ruleText}

Return plain JSON:
{
  "title": "short title",
  "summary": "2-3 sentence explanation",
  "assessor_bullets": ["bullet 1", "bullet 2", "bullet 3"]
}
`.trim()

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-OpenRouter-Title': 'Laya Claims Demo',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          {
            role: 'system',
            content: 'You explain rule-engine claim outcomes. You do not make decisions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content || '{}'

    return NextResponse.json({
      text: content,
      model: data?.model || 'openrouter/free',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to explain rules' },
      { status: 500 }
    )
  }
}