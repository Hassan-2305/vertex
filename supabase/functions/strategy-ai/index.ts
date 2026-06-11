import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CHAT_SYSTEM = `You are Vertex Strategy AI — an expert trading strategy advisor specialising in Indian markets (NSE, BSE, F&O). Help traders build, test, and refine strategies.
Keep responses concise, actionable, and formatted nicely in markdown. Suggest clear entry/exit points if relevant.

Rules:
- Focus on NSE/BSE markets and SEBI regulations
- Always include risk management: stop loss, position sizing
- Format strategies with: Entry, Exit, Stop Loss, Target, Timeframe
- Use relevant indicators: EMA, RSI, MACD, Bollinger Bands, VWAP
- End every strategy response with: ⚠️ Disclaimer: Educational only, not financial advice.`

const PARSE_SYSTEM = `You are a trading strategy parser. Convert a user's natural language strategy description into a strict JSON object.

Supported indicator types: EMA, SMA, RSI, MACD, BollingerBands, ATR, Supertrend, VWAP, STOCH, ADX, OBV
Supported condition operators: "crossAbove", "crossBelow", ">", "<", ">=", "<="
The "right" field of a condition can be either an indicator id (string) or a numeric constant.

Output ONLY valid JSON — no markdown, no explanation. Use this exact schema:
{
  "name": "string — short strategy name",
  "indicators": [
    { "id": "unique_id", "type": "EMA|SMA|RSI|MACD|BollingerBands|ATR|Supertrend|VWAP|STOCH|ADX|OBV", "period": number, "on": "close|open|high|low|volume", "extra": {} }
  ],
  "entry": {
    "logic": "AND|OR",
    "conditions": [
      { "left": "indicator_id or 'close'", "op": "crossAbove|crossBelow|>|<|>=|<=", "right": "indicator_id or number" }
    ]
  },
  "exit": {
    "logic": "AND|OR",
    "conditions": [
      { "left": "indicator_id or 'close'", "op": "crossAbove|crossBelow|>|<|>=|<=", "right": "indicator_id or number" }
    ]
  },
  "stopLoss": number_or_null,
  "takeProfit": number_or_null,
  "symbol": "string_or_null (Yahoo Finance format, e.g. KAYNES.BO for BSE, RELIANCE.NS for NSE. Extract if user mentions a stock)",
  "fromDate": "string_or_null (YYYY-MM-DD format if user mentions a start date)",
  "toDate": "string_or_null (YYYY-MM-DD format if user mentions an end date)",
  "description": "one line summary of strategy"
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured in Supabase secrets.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Mode: parse_strategy — returns a structured JSON rule object
    if (body.mode === 'parse_strategy') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: PARSE_SYSTEM },
            { role: 'user', content: body.text }
          ],
          max_tokens: 1000,
          temperature: 0.1, // Low temp for deterministic structured output
          response_format: { type: 'json_object' }
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Groq error')
      const raw = data.choices?.[0]?.message?.content
      const parsed = JSON.parse(raw)
      return new Response(JSON.stringify({ strategy: parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Default mode: chat
    const openaiMessages = [
      { role: 'system', content: CHAT_SYSTEM },
      ...body.messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
    ]
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: openaiMessages, max_tokens: 1500, temperature: 0.7 }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || `Groq error: ${response.status}`)
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('Empty response from Groq.')
    return new Response(JSON.stringify({ content: [{ text }] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
