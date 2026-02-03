import { OPENAI_API_KEY } from '$env/static/private';

export interface AIInsight {
	headline: string;
	context: string;
	talkingPoint: string;
	category: 'price' | 'inventory' | 'velocity' | 'market_condition';
	sentiment: 'positive' | 'negative' | 'neutral';
}

export type MarketCondition = 'sellers' | 'buyers' | 'balanced';

export interface AIMarketClassification {
	condition: MarketCondition;
	confidence: 'high' | 'medium' | 'low';
	reasoning: string;
}

export interface AIInsightsResult {
	insights: AIInsight[];
	marketCondition: AIMarketClassification | null;
}

export interface MarketSummary {
	latestDate: string;
	medianPrice: { current: number | null; yoyChange: number | null };
	averagePrice: { current: number | null; yoyChange: number | null };
	salesCount: { current: number | null; yoyChange: number | null };
	activeListings: { current: number | null; yoyChange: number | null };
	daysOnMarket: { current: number | null; yoyChange: number | null };
	monthsOfSupply: number | null;
	pricePerSqft: { current: number | null; yoyChange: number | null };
}

export async function generateAIInsights(summary: MarketSummary): Promise<AIInsightsResult> {
	if (!OPENAI_API_KEY) {
		console.error('OpenAI API key not configured');
		return { insights: [], marketCondition: null };
	}

	// Build a compact data summary to minimize tokens
	const dataPoints: string[] = [];

	if (summary.medianPrice.current) {
		dataPoints.push(`Median: $${(summary.medianPrice.current / 1000).toFixed(0)}K${summary.medianPrice.yoyChange ? ` (${summary.medianPrice.yoyChange > 0 ? '+' : ''}${summary.medianPrice.yoyChange.toFixed(1)}% YoY)` : ''}`);
	}
	if (summary.averagePrice.current) {
		dataPoints.push(`Avg: $${(summary.averagePrice.current / 1000).toFixed(0)}K${summary.averagePrice.yoyChange ? ` (${summary.averagePrice.yoyChange > 0 ? '+' : ''}${summary.averagePrice.yoyChange.toFixed(1)}% YoY)` : ''}`);
	}
	if (summary.salesCount.current) {
		dataPoints.push(`Sales: ${summary.salesCount.current}${summary.salesCount.yoyChange ? ` (${summary.salesCount.yoyChange > 0 ? '+' : ''}${summary.salesCount.yoyChange.toFixed(1)}% YoY)` : ''}`);
	}
	if (summary.activeListings.current) {
		dataPoints.push(`Inventory: ${summary.activeListings.current}${summary.activeListings.yoyChange ? ` (${summary.activeListings.yoyChange > 0 ? '+' : ''}${summary.activeListings.yoyChange.toFixed(1)}% YoY)` : ''}`);
	}
	if (summary.daysOnMarket.current) {
		dataPoints.push(`DOM: ${summary.daysOnMarket.current} days${summary.daysOnMarket.yoyChange ? ` (${summary.daysOnMarket.yoyChange > 0 ? '+' : ''}${summary.daysOnMarket.yoyChange.toFixed(1)}% YoY)` : ''}`);
	}
	if (summary.monthsOfSupply) {
		dataPoints.push(`MOS: ${summary.monthsOfSupply.toFixed(1)}`);
	}

	if (dataPoints.length === 0) {
		return { insights: [], marketCondition: null };
	}

	const prompt = `Real estate market data (${summary.latestDate}):
${dataPoints.join(', ')}

Analyze this data and provide:

1. MARKET CONDITION: Classify as "sellers" (favors sellers), "buyers" (favors buyers), or "balanced".
   Consider: months of supply (<4 = sellers, >6 = buyers), days on market (<30 = sellers, >60 = buyers), price trends, inventory levels.
   Provide confidence: "high", "medium", or "low".
   Give a brief reasoning (1 sentence).

2. INSIGHTS: Generate exactly 4 insights by category for a real estate agent to discuss with clients.
   Categories: "price" (pricing trends), "inventory" (supply/listings), "velocity" (sales pace/DOM), "market_condition" (overall market state).
   Each insight needs: headline (max 8 words), context (1 sentence explaining the data), talkingPoint (1 sentence the agent can say to clients), category, sentiment.
   Sentiment: "positive" (good news, growth, favorable), "negative" (concerning, declining, unfavorable), or "neutral" (stable, balanced, informational).

Respond in JSON only:
{
  "marketCondition": {"condition": "sellers|buyers|balanced", "confidence": "high|medium|low", "reasoning": "..."},
  "insights": [{"headline":"...","context":"...","talkingPoint":"...","category":"price|inventory|velocity|market_condition","sentiment":"positive|negative|neutral"}]
}`;

	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content: 'You are a real estate market analyst. Be concise and specific. Output valid JSON only.'
					},
					{ role: 'user', content: prompt }
				],
				temperature: 0.7,
				max_tokens: 700
			})
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('OpenAI API error:', error);
			return { insights: [], marketCondition: null };
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			return { insights: [], marketCondition: null };
		}

		// Parse JSON from response (handle potential markdown code blocks)
		const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
		const result = JSON.parse(jsonStr) as {
			marketCondition?: AIMarketClassification;
			insights?: AIInsight[];
		};

		return {
			insights: (result.insights ?? []).slice(0, 4),
			marketCondition: result.marketCondition ?? null
		};
	} catch (error) {
		console.error('Failed to generate AI insights:', error);
		return { insights: [], marketCondition: null };
	}
}
