export type MarketCondition = 'sellers' | 'buyers' | 'balanced';

export interface MarketClassification {
	condition: MarketCondition;
	confidence: 'high' | 'medium' | 'low';
	factors: MarketFactor[];
}

export interface MarketFactor {
	metric: string;
	value: number;
	indicator: MarketCondition;
	weight: number;
	description: string;
}

interface MarketMetrics {
	monthsOfSupply?: number;
	daysOnMarket?: number;
	listToSaleRatio?: number;
	priceYoYChange?: number;
}

interface ThresholdConfig {
	sellers: { max?: number; min?: number };
	buyers: { max?: number; min?: number };
}

const THRESHOLDS: Record<string, ThresholdConfig> = {
	monthsOfSupply: {
		sellers: { max: 4 },
		buyers: { min: 6 }
	},
	daysOnMarket: {
		sellers: { max: 30 },
		buyers: { min: 60 }
	},
	listToSaleRatio: {
		sellers: { min: 1.0 }, // 100%
		buyers: { max: 0.97 } // 97%
	},
	priceYoYChange: {
		sellers: { min: 5 }, // 5% growth
		buyers: { max: 0 } // negative growth
	}
};

const WEIGHTS = {
	monthsOfSupply: 3,
	daysOnMarket: 2,
	listToSaleRatio: 2,
	priceYoYChange: 1
};

function classifyMetric(
	metricName: string,
	value: number
): { condition: MarketCondition; description: string } {
	const threshold = THRESHOLDS[metricName];
	if (!threshold) {
		return { condition: 'balanced', description: '' };
	}

	switch (metricName) {
		case 'monthsOfSupply':
			if (threshold.sellers.max !== undefined && value < threshold.sellers.max) {
				return {
					condition: 'sellers',
					description: `${value.toFixed(1)} months of supply (under ${threshold.sellers.max} indicates seller's market)`
				};
			}
			if (threshold.buyers.min !== undefined && value > threshold.buyers.min) {
				return {
					condition: 'buyers',
					description: `${value.toFixed(1)} months of supply (over ${threshold.buyers.min} indicates buyer's market)`
				};
			}
			return {
				condition: 'balanced',
				description: `${value.toFixed(1)} months of supply (balanced range 4-6 months)`
			};

		case 'daysOnMarket':
			if (threshold.sellers.max !== undefined && value < threshold.sellers.max) {
				return {
					condition: 'sellers',
					description: `${Math.round(value)} days on market (fast sales under ${threshold.sellers.max} days)`
				};
			}
			if (threshold.buyers.min !== undefined && value > threshold.buyers.min) {
				return {
					condition: 'buyers',
					description: `${Math.round(value)} days on market (slow sales over ${threshold.buyers.min} days)`
				};
			}
			return {
				condition: 'balanced',
				description: `${Math.round(value)} days on market (typical 30-60 day range)`
			};

		case 'listToSaleRatio':
			if (threshold.sellers.min !== undefined && value >= threshold.sellers.min) {
				return {
					condition: 'sellers',
					description: `${(value * 100).toFixed(1)}% list-to-sale (at or above list price)`
				};
			}
			if (threshold.buyers.max !== undefined && value < threshold.buyers.max) {
				return {
					condition: 'buyers',
					description: `${(value * 100).toFixed(1)}% list-to-sale (significant negotiation room)`
				};
			}
			return {
				condition: 'balanced',
				description: `${(value * 100).toFixed(1)}% list-to-sale (modest discounts typical)`
			};

		case 'priceYoYChange':
			if (threshold.sellers.min !== undefined && value >= threshold.sellers.min) {
				return {
					condition: 'sellers',
					description: `${value > 0 ? '+' : ''}${value.toFixed(1)}% YoY price change (strong appreciation)`
				};
			}
			if (threshold.buyers.max !== undefined && value <= threshold.buyers.max) {
				return {
					condition: 'buyers',
					description: `${value.toFixed(1)}% YoY price change (prices declining)`
				};
			}
			return {
				condition: 'balanced',
				description: `${value > 0 ? '+' : ''}${value.toFixed(1)}% YoY price change (moderate growth)`
			};

		default:
			return { condition: 'balanced', description: '' };
	}
}

export function classifyMarket(metrics: MarketMetrics): MarketClassification {
	const factors: MarketFactor[] = [];
	let sellersScore = 0;
	let buyersScore = 0;
	let totalWeight = 0;

	if (metrics.monthsOfSupply !== undefined) {
		const classification = classifyMetric('monthsOfSupply', metrics.monthsOfSupply);
		const weight = WEIGHTS.monthsOfSupply;
		factors.push({
			metric: 'Months of Supply',
			value: metrics.monthsOfSupply,
			indicator: classification.condition,
			weight,
			description: classification.description
		});

		if (classification.condition === 'sellers') sellersScore += weight;
		else if (classification.condition === 'buyers') buyersScore += weight;
		totalWeight += weight;
	}

	if (metrics.daysOnMarket !== undefined) {
		const classification = classifyMetric('daysOnMarket', metrics.daysOnMarket);
		const weight = WEIGHTS.daysOnMarket;
		factors.push({
			metric: 'Days on Market',
			value: metrics.daysOnMarket,
			indicator: classification.condition,
			weight,
			description: classification.description
		});

		if (classification.condition === 'sellers') sellersScore += weight;
		else if (classification.condition === 'buyers') buyersScore += weight;
		totalWeight += weight;
	}

	if (metrics.listToSaleRatio !== undefined) {
		const classification = classifyMetric('listToSaleRatio', metrics.listToSaleRatio);
		const weight = WEIGHTS.listToSaleRatio;
		factors.push({
			metric: 'List-to-Sale Ratio',
			value: metrics.listToSaleRatio,
			indicator: classification.condition,
			weight,
			description: classification.description
		});

		if (classification.condition === 'sellers') sellersScore += weight;
		else if (classification.condition === 'buyers') buyersScore += weight;
		totalWeight += weight;
	}

	if (metrics.priceYoYChange !== undefined) {
		const classification = classifyMetric('priceYoYChange', metrics.priceYoYChange);
		const weight = WEIGHTS.priceYoYChange;
		factors.push({
			metric: 'Price YoY Change',
			value: metrics.priceYoYChange,
			indicator: classification.condition,
			weight,
			description: classification.description
		});

		if (classification.condition === 'sellers') sellersScore += weight;
		else if (classification.condition === 'buyers') buyersScore += weight;
		totalWeight += weight;
	}

	// Determine overall condition and confidence
	let condition: MarketCondition;
	let confidence: 'high' | 'medium' | 'low';

	if (totalWeight === 0) {
		return { condition: 'balanced', confidence: 'low', factors: [] };
	}

	const sellersRatio = sellersScore / totalWeight;
	const buyersRatio = buyersScore / totalWeight;

	if (sellersRatio >= 0.6) {
		condition = 'sellers';
		confidence = sellersRatio >= 0.8 ? 'high' : 'medium';
	} else if (buyersRatio >= 0.6) {
		condition = 'buyers';
		confidence = buyersRatio >= 0.8 ? 'high' : 'medium';
	} else {
		condition = 'balanced';
		// Balanced is high confidence when neither side dominates
		const maxRatio = Math.max(sellersRatio, buyersRatio);
		confidence = maxRatio < 0.4 ? 'high' : maxRatio < 0.5 ? 'medium' : 'low';
	}

	return { condition, confidence, factors };
}

export function getConditionLabel(condition: MarketCondition): string {
	switch (condition) {
		case 'sellers':
			return "Seller's Market";
		case 'buyers':
			return "Buyer's Market";
		case 'balanced':
			return 'Balanced Market';
	}
}

export function getConditionColor(condition: MarketCondition): string {
	switch (condition) {
		case 'sellers':
			return '#ef4444'; // red
		case 'buyers':
			return '#22c55e'; // green
		case 'balanced':
			return '#d4a853'; // gold
	}
}
