import {
	classifyMarket,
	getConditionLabel,
	type MarketClassification
} from './market-conditions';
import {
	compareToSeasonal,
	getSeasonalContext,
	getMonthName,
	isTypicallyStrongMonth,
	isTypicallyWeakMonth
} from './seasonal-patterns';
import { formatValue, calculatePercentChange } from '$lib/validation';

export type InsightCategory = 'market_condition' | 'price' | 'inventory' | 'velocity';
export type InsightPriority = 'high' | 'medium' | 'low';

export interface EnhancedInsight {
	id: string;
	headline: string;
	context: string;
	agentTalkingPoint: string;
	priority: InsightPriority;
	category: InsightCategory;
}

export interface MetricData {
	date: string;
	value: number;
}

export interface TimelinePoint {
	date: string;
	median_price?: number;
	average_price?: number;
	sales_count?: number;
	active_listings?: number;
	days_on_market?: number;
	price_per_sqft?: number;
	list_to_sale_ratio?: number;
	months_of_supply?: number;
}

interface InsightContext {
	latestDate: string;
	priorMonthDate: string | null;
	priorYearDate: string | null;
	timeline: TimelinePoint[];
	metricsByDate: Record<string, Record<string, number>>;
}

function getMonth(dateStr: string): number {
	return new Date(`${dateStr}T12:00:00`).getMonth() + 1;
}

function shiftYear(dateStr: string, years: number): string {
	const date = new Date(`${dateStr}T12:00:00`);
	date.setFullYear(date.getFullYear() + years);
	return date.toISOString().split('T')[0];
}

function valueAt(
	metricsByDate: Record<string, Record<string, number>>,
	metricTypeId: string,
	dateStr: string | null
): number | null {
	if (!dateStr) return null;
	return metricsByDate[dateStr]?.[metricTypeId] ?? null;
}

function latestValue(
	metricsByDate: Record<string, Record<string, number>>,
	metricTypeId: string,
	latestDate: string
): number | null {
	return metricsByDate[latestDate]?.[metricTypeId] ?? null;
}

export function generateEnhancedInsights(ctx: InsightContext): EnhancedInsight[] {
	const insights: EnhancedInsight[] = [];
	const { latestDate, priorMonthDate, metricsByDate } = ctx;
	const priorYearDate = shiftYear(latestDate, -1);
	const month = getMonth(latestDate);
	const monthName = getMonthName(month);

	// Get current values
	const median = latestValue(metricsByDate, 'median_price', latestDate);
	const sales = latestValue(metricsByDate, 'sales_count', latestDate);
	const activeListings = latestValue(metricsByDate, 'active_listings', latestDate);
	const dom = latestValue(metricsByDate, 'days_on_market', latestDate);
	const listToSale = latestValue(metricsByDate, 'list_to_sale_ratio', latestDate);

	// Calculate changes
	const medianPrior = valueAt(metricsByDate, 'median_price', priorMonthDate);
	const medianYoY = valueAt(metricsByDate, 'median_price', priorYearDate);
	const medianMoM = median !== null && medianPrior !== null ? calculatePercentChange(median, medianPrior) : null;
	const medianYoYChange = median !== null && medianYoY !== null ? calculatePercentChange(median, medianYoY) : null;

	const salesYoY = valueAt(metricsByDate, 'sales_count', priorYearDate);
	const salesYoYChange = sales !== null && salesYoY !== null ? calculatePercentChange(sales, salesYoY) : null;

	// Calculate months of supply
	const monthsOfSupply = activeListings !== null && sales !== null && sales > 0
		? activeListings / sales
		: null;

	// 1. Market Condition Classification
	const marketClassification = classifyMarket({
		monthsOfSupply: monthsOfSupply ?? undefined,
		daysOnMarket: dom ?? undefined,
		listToSaleRatio: listToSale ?? undefined,
		priceYoYChange: medianYoYChange ?? undefined
	});

	insights.push(generateMarketConditionInsight(marketClassification, monthsOfSupply, dom));

	// 2. Price Insights with Seasonal Context
	if (median !== null && medianYoYChange !== null) {
		insights.push(generatePriceInsight(median, medianMoM, medianYoYChange, month, monthName, marketClassification));
	}

	// 3. Inventory Insights
	if (activeListings !== null) {
		const listingsYoY = valueAt(metricsByDate, 'active_listings', priorYearDate);
		const listingsYoYChange = listingsYoY !== null ? calculatePercentChange(activeListings, listingsYoY) : null;
		insights.push(generateInventoryInsight(activeListings, monthsOfSupply, listingsYoYChange, month));
	}

	// 4. Velocity Insights (Sales + DOM)
	if (sales !== null || dom !== null) {
		insights.push(generateVelocityInsight(sales, salesYoYChange, dom, month, monthName));
	}

	// 5. Spread Analysis (Average vs Median)
	const avgPrice = latestValue(metricsByDate, 'average_price', latestDate);
	if (avgPrice !== null && median !== null) {
		const insight = generateSpreadInsight(avgPrice, median);
		if (insight) insights.push(insight);
	}

	return insights.filter((i) => i !== null) as EnhancedInsight[];
}

function generateMarketConditionInsight(
	classification: MarketClassification,
	monthsOfSupply: number | null,
	dom: number | null
): EnhancedInsight {
	const label = getConditionLabel(classification.condition);
	const factorDescriptions = classification.factors
		.filter((f) => f.indicator === classification.condition)
		.map((f) => f.description)
		.slice(0, 2);

	let context = `Based on ${factorDescriptions.join(' and ')}.`;
	let talkingPoint: string;

	switch (classification.condition) {
		case 'sellers':
			talkingPoint =
				"Tell buyers: 'Be prepared to act fast and come in with your strongest offer. Multiple offers are common right now.'";
			break;
		case 'buyers':
			talkingPoint =
				"Tell buyers: 'You have negotiating power right now. Take your time, make reasonable offers, and don't be afraid to ask for concessions.'";
			break;
		case 'balanced':
			talkingPoint =
				"Position this as: 'The market is in equilibrium. Well-priced homes sell well, but there's room for thoughtful negotiation.'";
			break;
	}

	return {
		id: 'market-condition',
		headline: `${label} (${classification.confidence} confidence)`,
		context,
		agentTalkingPoint: talkingPoint,
		priority: 'high',
		category: 'market_condition'
	};
}

function generatePriceInsight(
	median: number,
	momChange: number | null,
	yoyChange: number,
	month: number,
	monthName: string,
	classification: MarketClassification
): EnhancedInsight {
	const seasonal = compareToSeasonal('median_price', month, yoyChange);
	const seasonalContext = getSeasonalContext('median_price', month, yoyChange);
	const formattedMedian = formatValue('median_price', median);

	let headline: string;
	let priority: InsightPriority;

	if (seasonal === 'above') {
		headline = 'Prices outperforming seasonal norms';
		priority = 'high';
	} else if (seasonal === 'below') {
		headline = 'Prices underperforming seasonal expectations';
		priority = 'high';
	} else {
		headline = 'Prices tracking seasonal patterns';
		priority = 'medium';
	}

	const direction = yoyChange >= 0 ? 'up' : 'down';
	const context = `Median price at ${formattedMedian}, ${Math.abs(yoyChange).toFixed(1)}% ${direction} YoY. ${seasonalContext}.`;

	let talkingPoint: string;
	if (yoyChange >= 5 && classification.condition === 'sellers') {
		talkingPoint = "Position this as: 'Despite rate concerns, our market remains resilient with strong price appreciation.'";
	} else if (yoyChange < 0) {
		talkingPoint = "Frame this as: 'We're seeing a price correction that's creating buying opportunities. This is a good time to enter the market.'";
	} else {
		talkingPoint = `Tell clients: 'Prices in ${monthName} are following typical seasonal patterns with ${Math.abs(yoyChange).toFixed(1)}% annual growth.'`;
	}

	return {
		id: 'price-trend',
		headline,
		context,
		agentTalkingPoint: talkingPoint,
		priority,
		category: 'price'
	};
}

function generateInventoryInsight(
	activeListings: number,
	monthsOfSupply: number | null,
	yoyChange: number | null,
	month: number
): EnhancedInsight {
	const seasonal = compareToSeasonal('active_listings', month, yoyChange ?? 0);

	let headline: string;
	let priority: InsightPriority;

	if (monthsOfSupply !== null && monthsOfSupply < 3) {
		headline = 'Critically low inventory';
		priority = 'high';
	} else if (monthsOfSupply !== null && monthsOfSupply > 6) {
		headline = 'Elevated inventory levels';
		priority = 'high';
	} else if (seasonal === 'above') {
		headline = 'Inventory above seasonal norms';
		priority = 'medium';
	} else if (seasonal === 'below') {
		headline = 'Inventory below seasonal norms';
		priority = 'medium';
	} else {
		headline = 'Inventory at typical levels';
		priority = 'low';
	}

	let context = `${activeListings.toLocaleString()} active listings`;
	if (monthsOfSupply !== null) {
		context += ` representing ${monthsOfSupply.toFixed(1)} months of supply`;
	}
	if (yoyChange !== null) {
		const dir = yoyChange >= 0 ? 'up' : 'down';
		context += ` (${Math.abs(yoyChange).toFixed(1)}% ${dir} YoY)`;
	}
	context += '.';

	let talkingPoint: string;
	if (monthsOfSupply !== null && monthsOfSupply < 4) {
		talkingPoint =
			"Tell sellers: 'Low inventory means your home will get maximum exposure. Well-priced properties are selling quickly.'";
	} else if (monthsOfSupply !== null && monthsOfSupply > 6) {
		talkingPoint =
			"Tell buyers: 'More options are available now. You can be selective and negotiate from a position of strength.'";
	} else {
		talkingPoint =
			"Position this as: 'Inventory is balanced, so both buyers and sellers can transact with confidence.'";
	}

	return {
		id: 'inventory',
		headline,
		context,
		agentTalkingPoint: talkingPoint,
		priority,
		category: 'inventory'
	};
}

function generateVelocityInsight(
	sales: number | null,
	salesYoYChange: number | null,
	dom: number | null,
	month: number,
	monthName: string
): EnhancedInsight {
	const isStrongSalesMonth = isTypicallyStrongMonth('sales_count', month);
	const isWeakSalesMonth = isTypicallyWeakMonth('sales_count', month);

	let headline: string;
	let priority: InsightPriority;
	let contextParts: string[] = [];

	if (dom !== null && dom < 30) {
		headline = 'Fast market velocity';
		priority = 'high';
	} else if (dom !== null && dom > 60) {
		headline = 'Slow market velocity';
		priority = 'high';
	} else if (salesYoYChange !== null && Math.abs(salesYoYChange) > 15) {
		headline = salesYoYChange > 0 ? 'Sales volume surging' : 'Sales volume declining';
		priority = 'medium';
	} else {
		headline = 'Steady market velocity';
		priority = 'low';
	}

	if (sales !== null) {
		contextParts.push(`${sales.toLocaleString()} sales this month`);
		if (salesYoYChange !== null) {
			const dir = salesYoYChange >= 0 ? 'higher' : 'lower';
			contextParts.push(`${Math.abs(salesYoYChange).toFixed(1)}% ${dir} than last ${monthName}`);
		}
	}

	if (dom !== null) {
		contextParts.push(`averaging ${Math.round(dom)} days on market`);
	}

	const context = contextParts.join(', ') + '.';

	let talkingPoint: string;
	if (dom !== null && dom < 30) {
		talkingPoint =
			"Tell buyers: 'When you find the right home, be ready to move quickly. Properties are selling fast.'";
	} else if (dom !== null && dom > 60) {
		talkingPoint =
			"Tell buyers: 'Sellers are more willing to negotiate. Consider making an offer below asking price.'";
	} else if (isStrongSalesMonth && salesYoYChange !== null && salesYoYChange < -10) {
		talkingPoint = `Note to clients: 'Even though ${monthName} is typically a strong month, we're seeing slower activity this year.'`;
	} else if (isWeakSalesMonth && salesYoYChange !== null && salesYoYChange > 10) {
		talkingPoint = `Note to clients: 'Unusually strong activity for ${monthName}—motivated buyers are still active in the market.'`;
	} else {
		talkingPoint =
			"Position this as: 'The market is moving at a healthy pace with typical time-to-sell.'";
	}

	return {
		id: 'velocity',
		headline,
		context,
		agentTalkingPoint: talkingPoint,
		priority,
		category: 'velocity'
	};
}

function generateSpreadInsight(
	avgPrice: number,
	medianPrice: number
): EnhancedInsight | null {
	const spread = avgPrice - medianPrice;
	const spreadPercent = (spread / medianPrice) * 100;

	// Only generate insight if spread is significant
	if (Math.abs(spreadPercent) < 5) {
		return null;
	}

	const headline = spreadPercent > 0 ? 'High-end activity lifting averages' : 'Entry-level homes dominating sales';
	const formattedSpread = formatValue('average_price', Math.abs(spread));
	const formattedAvg = formatValue('average_price', avgPrice);

	const context =
		spreadPercent > 0
			? `Average price (${formattedAvg}) is ${formattedSpread} above median, indicating strong luxury market activity.`
			: `Average price (${formattedAvg}) is ${formattedSpread} below median, indicating first-time buyer activity.`;

	const talkingPoint =
		spreadPercent > 0
			? "Position this as: 'Luxury properties are trading well in this market—there's buyer appetite at higher price points.'"
			: "Position this as: 'First-time buyers are active, and entry-level homes are seeing strong demand.'";

	return {
		id: 'price-spread',
		headline,
		context,
		agentTalkingPoint: talkingPoint,
		priority: 'low',
		category: 'price'
	};
}

export function getMarketClassification(ctx: InsightContext): MarketClassification {
	const { latestDate, metricsByDate } = ctx;
	const priorYearDate = shiftYear(latestDate, -1);

	const sales = latestValue(metricsByDate, 'sales_count', latestDate);
	const activeListings = latestValue(metricsByDate, 'active_listings', latestDate);
	const dom = latestValue(metricsByDate, 'days_on_market', latestDate);
	const listToSale = latestValue(metricsByDate, 'list_to_sale_ratio', latestDate);
	const median = latestValue(metricsByDate, 'median_price', latestDate);
	const medianYoY = valueAt(metricsByDate, 'median_price', priorYearDate);

	const monthsOfSupply = activeListings !== null && sales !== null && sales > 0
		? activeListings / sales
		: undefined;

	const priceYoYChange = median !== null && medianYoY !== null
		? calculatePercentChange(median, medianYoY)
		: undefined;

	return classifyMarket({
		monthsOfSupply,
		daysOnMarket: dom ?? undefined,
		listToSaleRatio: listToSale ?? undefined,
		priceYoYChange: priceYoYChange ?? undefined
	});
}
