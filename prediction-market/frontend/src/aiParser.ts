// AI-powered natural language market creation using Gemini API

export interface ParsedMarket {
  question: string;
  asset: string;
  targetPrice: string;
}

const PARSE_PROMPT = `You are a prediction market parser. Given a user's natural language input, extract:
1. "question": A clean YES/NO prediction market question (e.g. "Will Bitcoin exceed $100,000?")
2. "asset": The CoinGecko asset ID (e.g. "bitcoin", "ethereum", "solana", "dogecoin", "cardano", "chainlink", "avalanche-2"). For non-price event markets, use a descriptive kebab-case slug (e.g. "gpt5-release", "eth-pectra-upgrade").
3. "targetPrice": The USD price target as a number. Use 0 for event/non-price markets.

Respond with ONLY a valid JSON object: {"question":"...","asset":"...","targetPrice":...}
No markdown, no backticks, no explanation.

Examples:
- "BTC 150K by summer" → {"question":"Will Bitcoin exceed $150,000 by August 2026?","asset":"bitcoin","targetPrice":150000}
- "Will Apple release Vision Pro 2?" → {"question":"Will Apple release Vision Pro 2 in 2026?","asset":"apple-vision-pro-2","targetPrice":0}
- "doge to a dollar" → {"question":"Will Dogecoin exceed $1.00?","asset":"dogecoin","targetPrice":1}
- "ETH flippening" → {"question":"Will Ethereum market cap exceed Bitcoin market cap by 2027?","asset":"ethereum","targetPrice":0}`;

export async function parseMarketQuestion(input: string): Promise<ParsedMarket> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI unavailable — API key not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${PARSE_PROMPT}\n\nUser input: ${input}` }] }],
  });

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
  }

  if (!res || !res.ok) {
    throw new Error(res?.status === 429 ? "Rate limited — wait a moment and retry" : "AI service unavailable. Please fill the form manually.");
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from AI");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Couldn't parse that. Try being more specific.");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.question || !parsed.asset || parsed.targetPrice === undefined) {
    throw new Error("Couldn't extract market details. Try being more specific.");
  }

  return {
    question: String(parsed.question),
    asset: String(parsed.asset),
    targetPrice: String(parsed.targetPrice),
  };
}
