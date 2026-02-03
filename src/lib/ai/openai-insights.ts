import { OPENAI_API_KEY } from '$env/static/private';

export interface AIInsight {
	headline: string;
	context: string;
	talkingPoint: string;
	audience: 'buyer' | 'seller';
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

export async function generateAIInsights(summary: MarketSummary): Promise<AIInsight[]> {
	if (!OPENAI_API_KEY) {
		console.error('OpenAI API key not configured');
		return [];
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
		return [];
	}

	const prompt = `Real estate market data (${summary.latestDate}):
${dataPoints.join(', ')}

Generate 4 insights for a real estate agent - 2 for buyer clients, 2 for seller clients.
Each insight needs:
1. headline (max 8 words)
2. context (1 sentence explaining the data)
3. talkingPoint (1 sentence the agent can say to that client type)
4. audience ("buyer" or "seller")

Respond in JSON array only: [{"headline":"...","context":"...","talkingPoint":"...","audience":"buyer"}]`;

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
				max_tokens: 500
			})
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('OpenAI API error:', error);
			return [];
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			return [];
		}

		// Parse JSON from response (handle potential markdown code blocks)
		const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
		const insights = JSON.parse(jsonStr) as AIInsight[];

		return insights.slice(0, 4); // 2 buyer + 2 seller insights
	} catch (error) {
		console.error('Failed to generate AI insights:', error);
		return [];
	}
}
