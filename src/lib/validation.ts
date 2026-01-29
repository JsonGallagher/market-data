export interface MetricValidation {
	isValid: boolean;
	isOutlier: boolean;
	reason?: string;
}

export const METRIC_BOUNDS: Record<string, { min: number; max: number; unit: string }> = {
	median_price: { min: 10000, max: 50000000, unit: 'USD' },
	average_price: { min: 10000, max: 50000000, unit: 'USD' },
	price_per_sqft: { min: 10, max: 5000, unit: 'USD' },
	active_listings: { min: 0, max: 100000, unit: 'count' },
	sales_count: { min: 0, max: 100000, unit: 'count' },
	days_on_market: { min: 0, max: 1000, unit: 'days' },
	months_of_supply: { min: 0, max: 36, unit: 'months' },
	list_to_sale_ratio: { min: 0.5, max: 1.5, unit: 'ratio' }
};

export function validateMetricValue(
	metricTypeId: string,
	value: number
): MetricValidation {
	const bounds = METRIC_BOUNDS[metricTypeId];

	if (!bounds) {
		return { isValid: true, isOutlier: false };
	}

	if (isNaN(value)) {
		return {
			isValid: false,
			isOutlier: false,
			reason: 'Value must be a number'
		};
	}

	if (value < bounds.min) {
		return {
			isValid: true,
			isOutlier: true,
			reason: `Value ${formatValue(metricTypeId, value)} is below expected range (min: ${formatValue(metricTypeId, bounds.min)})`
		};
	}

	if (value > bounds.max) {
		return {
			isValid: true,
			isOutlier: true,
			reason: `Value ${formatValue(metricTypeId, value)} is above expected range (max: ${formatValue(metricTypeId, bounds.max)})`
		};
	}

	return { isValid: true, isOutlier: false };
}

export function formatValue(metricTypeId: string, value: number): string {
	const bounds = METRIC_BOUNDS[metricTypeId];

	if (!bounds) {
		return value.toLocaleString();
	}

	switch (bounds.unit) {
		case 'USD':
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
				maximumFractionDigits: 0
			}).format(value);
		case 'ratio':
			return `${(value * 100).toFixed(1)}%`;
		case 'months':
			return `${value.toFixed(1)} mo`;
		case 'days':
			return `${Math.round(value)} days`;
		case 'count':
			return value.toLocaleString();
		default:
			return value.toLocaleString();
	}
}

export function calculatePercentChange(current: number, previous: number): number | null {
	if (previous === 0) return null;
	return ((current - previous) / previous) * 100;
}
