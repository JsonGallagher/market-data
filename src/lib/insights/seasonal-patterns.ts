export type SeasonalComparison = 'above' | 'below' | 'typical';

// Typical monthly deviations from annual baseline (in percent)
// Based on general US residential real estate patterns
const SEASONAL_BASELINES: Record<string, Record<number, number>> = {
	// Median price typically peaks in summer months
	median_price: {
		1: 0.5, // Jan - slight uptick from year end
		2: 1.0, // Feb
		3: 2.0, // Mar - spring market starts
		4: 2.5, // Apr
		5: 3.0, // May - peak season
		6: 2.5, // Jun
		7: 2.0, // Jul
		8: 1.5, // Aug
		9: 0.5, // Sep
		10: 0.0, // Oct
		11: -1.0, // Nov
		12: -1.5 // Dec - holiday slowdown
	},
	average_price: {
		1: 0.5,
		2: 1.0,
		3: 2.0,
		4: 2.5,
		5: 3.0,
		6: 2.5,
		7: 2.0,
		8: 1.5,
		9: 0.5,
		10: 0.0,
		11: -1.0,
		12: -1.5
	},
	// Sales volume is highly seasonal
	sales_count: {
		1: -15, // Jan - slow start
		2: -5, // Feb
		3: 15, // Mar - spring market
		4: 20, // Apr
		5: 25, // May - peak
		6: 20, // Jun
		7: 15, // Jul
		8: 10, // Aug
		9: 0, // Sep
		10: -5, // Oct
		11: -15, // Nov
		12: -20 // Dec - holiday slowdown
	},
	// Days on market inverse to demand
	days_on_market: {
		1: 10, // Jan - slower
		2: 5, // Feb
		3: -10, // Mar - faster sales
		4: -15, // Apr
		5: -15, // May
		6: -10, // Jun
		7: -5, // Jul
		8: 0, // Aug
		9: 5, // Sep
		10: 10, // Oct
		11: 15, // Nov
		12: 15 // Dec - slower
	},
	// Active listings typically peak in late spring/summer
	active_listings: {
		1: -10, // Jan
		2: -5, // Feb
		3: 5, // Mar
		4: 15, // Apr
		5: 20, // May
		6: 15, // Jun
		7: 10, // Jul
		8: 5, // Aug
		9: 0, // Sep
		10: -5, // Oct
		11: -10, // Nov
		12: -15 // Dec
	}
};

// Threshold for determining "typical" vs above/below (percentage points)
const TYPICAL_THRESHOLD = 3;

export function getSeasonalBaseline(metric: string, month: number): number | null {
	const metricBaseline = SEASONAL_BASELINES[metric];
	if (!metricBaseline) return null;
	return metricBaseline[month] ?? null;
}

export function compareToSeasonal(
	metric: string,
	month: number,
	actualChange: number
): SeasonalComparison {
	const baseline = getSeasonalBaseline(metric, month);

	if (baseline === null) {
		return 'typical';
	}

	const difference = actualChange - baseline;

	if (difference > TYPICAL_THRESHOLD) {
		return 'above';
	}
	if (difference < -TYPICAL_THRESHOLD) {
		return 'below';
	}
	return 'typical';
}

export function getSeasonalContext(
	metric: string,
	month: number,
	actualChange: number
): string {
	const baseline = getSeasonalBaseline(metric, month);
	const comparison = compareToSeasonal(metric, month, actualChange);
	const monthName = getMonthName(month);

	if (baseline === null) {
		return '';
	}

	const metricLabel = getMetricLabel(metric);
	const typicalDirection = baseline >= 0 ? 'gains' : 'declines';
	const typicalAmount = Math.abs(baseline);

	switch (comparison) {
		case 'above':
			return `${metricLabel} is outperforming typical ${monthName} patterns (usually ${typicalAmount.toFixed(0)}% ${typicalDirection})`;
		case 'below':
			return `${metricLabel} is underperforming typical ${monthName} patterns (usually ${typicalAmount.toFixed(0)}% ${typicalDirection})`;
		case 'typical':
			return `${metricLabel} is tracking typical ${monthName} seasonal patterns`;
	}
}

export function getMonthName(month: number): string {
	const months = [
		'',
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	return months[month] ?? '';
}

function getMetricLabel(metric: string): string {
	const labels: Record<string, string> = {
		median_price: 'Median price',
		average_price: 'Average price',
		sales_count: 'Sales volume',
		days_on_market: 'Days on market',
		active_listings: 'Active inventory'
	};
	return labels[metric] ?? metric;
}

export function getSeasonDescription(month: number): string {
	if (month >= 3 && month <= 5) return 'spring market';
	if (month >= 6 && month <= 8) return 'summer market';
	if (month >= 9 && month <= 11) return 'fall market';
	return 'winter market';
}

export function isTypicallyStrongMonth(metric: string, month: number): boolean {
	const baseline = getSeasonalBaseline(metric, month);
	if (baseline === null) return false;

	// For days on market, negative is "strong" (faster sales)
	if (metric === 'days_on_market') {
		return baseline < -5;
	}

	return baseline > 5;
}

export function isTypicallyWeakMonth(metric: string, month: number): boolean {
	const baseline = getSeasonalBaseline(metric, month);
	if (baseline === null) return false;

	// For days on market, positive is "weak" (slower sales)
	if (metric === 'days_on_market') {
		return baseline > 5;
	}

	return baseline < -5;
}
