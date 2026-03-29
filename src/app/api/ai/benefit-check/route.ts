import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { query } = await request.json()

  // If no Anthropic key, return a canned response
  if (!process.env.ANTHROPIC_API_KEY) {
    const lowerQuery = query.toLowerCase()
    let answer: string

    if (lowerQuery.includes('physio') || lowerQuery.includes('physiotherapy')) {
      answer = 'Yes, physiotherapy is covered under your Premium Health plan. You are entitled to up to 25 sessions per year with a registered physiotherapist, subject to a GP referral. The plan covers up to \u20AC40 per session. Call 1890 700 890 for full details.'
    } else if (lowerQuery.includes('dental')) {
      answer = 'Dental cover is included in your Premium Health plan. You are covered for one routine check-up and cleaning per year, plus emergency dental treatment. The annual dental benefit limit is \u20AC750. Call 1890 700 890 for full details.'
    } else if (lowerQuery.includes('optical') || lowerQuery.includes('eye') || lowerQuery.includes('glasses')) {
      answer = 'Optical cover is included in your Premium Health plan. You are entitled to one eye examination every two years and a contribution towards prescription glasses or contact lenses up to \u20AC300. Call 1890 700 890 for full details.'
    } else if (lowerQuery.includes('hospital') || lowerQuery.includes('inpatient') || lowerQuery.includes('surgery')) {
      answer = 'Your Premium Health plan provides full cover for inpatient hospital treatment in semi-private rooms in participating hospitals. Pre-authorisation is required for elective procedures. Emergency admissions are covered without pre-authorisation. Call 1890 700 890 for full details.'
    } else if (lowerQuery.includes('gp') || lowerQuery.includes('doctor') || lowerQuery.includes('general practitioner')) {
      answer = 'GP visits are covered under your Premium Health plan. You can claim back up to \u20AC40 per GP visit, with a maximum of 20 visits per year. No referral is required. Call 1890 700 890 for full details.'
    } else if (lowerQuery.includes('mental health') || lowerQuery.includes('counselling') || lowerQuery.includes('therapy')) {
      answer = 'Mental health support is covered under your Premium Health plan. You are entitled to up to 15 counselling or psychotherapy sessions per year with a registered practitioner, subject to GP referral. The plan covers up to \u20AC60 per session. Call 1890 700 890 for full details.'
    } else if (lowerQuery.includes('maternity') || lowerQuery.includes('pregnancy')) {
      answer = 'Maternity cover is included in your Premium Health plan after a 52-week waiting period. This includes antenatal visits, hospital delivery, and postnatal care. A maternity benefit of \u20AC3,000 is payable. Call 1890 700 890 for full details.'
    } else {
      answer = `Thank you for your question about "${query}". Under the Laya Healthcare Premium Health plan, a wide range of treatments and services are covered. For specific details about this particular query, I recommend contacting our member services team who can provide personalised information about your coverage and any applicable limits or waiting periods. Call 1890 700 890 for full details.`
    }

    return NextResponse.json({ answer })
  }

  // Real Anthropic path
  const Anthropic = (await import('@anthropic-ai/sdk')).default
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
