export interface InflectionPoint {
	date: string;
	value: number;
	type: 'peak' | 'trough' | 'acceleration' | 'deceleration';
	magnitude: number; // Percent change from surrounding points
	description: string;
}

export interface DataPoint {
	date: string;
	value: number;
}

const MAX_INFLECTION_POINTS = 5;
const MIN_MAGNITUDE_THRESHOLD = 5; // Minimum 5% deviation to be significant

export function detectInflectionPoints(
	data: DataPoint[],
	metricLabel: string = 'Value'
): InflectionPoint[] {
	if (data.length < 5) {
		return [];
	}

	// Sort by date
	const sorted = [...data].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	const inflections: InflectionPoint[] = [];

	// Detect local peaks and troughs using 3-point window
	for (let i = 1; i < sorted.length - 1; i++) {
		const prev = sorted[i - 1].value;
		const curr = sorted[i].value;
		const next = sorted[i + 1].value;

		// Local peak
		if (curr > prev && curr > next) {
			const leftChange = ((curr - prev) / prev) * 100;
			const rightChange = ((curr - next) / next) * 100;
			const magnitude = Math.min(leftChange, rightChange);

			if (magnitude >= MIN_MAGNITUDE_THRESHOLD) {
				inflections.push({
					date: sorted[i].date,
					value: curr,
					type: 'peak',
					magnitude,
					description: `${metricLabel} peaked at ${formatNumber(curr)}`
				});
			}
		}

		// Local trough
		if (curr < prev && curr < next) {
			const leftChange = ((prev - curr) / curr) * 100;
			const rightChange = ((next - curr) / curr) * 100;
			const magnitude = Math.min(leftChange, rightChange);

			if (magnitude >= MIN_MAGNITUDE_THRESHOLD) {
				inflections.push({
					date: sorted[i].date,
					value: curr,
					type: 'trough',
					magnitude,
					description: `${metricLabel} bottomed at ${formatNumber(curr)}`
				});
			}
		}
	}

	// Detect momentum changes (acceleration/deceleration)
	const momentumChanges = detectMomentumChanges(sorted, metricLabel);
	inflections.push(...momentumChanges);

	// Sort by magnitude and take top N
	const sortedInflections = inflections
		.sort((a, b) => b.magnitude - a.magnitude)
		.slice(0, MAX_INFLECTION_POINTS);

	// Re-sort by date for display
	return sortedInflections.sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);
}

function detectMomentumChanges(
	data: DataPoint[],
	metricLabel: string
): InflectionPoint[] {
	if (data.length < 6) return [];

	const changes: InflectionPoint[] = [];

	// Calculate rolling 3-month momentum
	for (let i = 3; i < data.length - 2; i++) {
		// Previous momentum (3-month lookback)
		const prevMomentum = calculateMomentum(
			data[i - 3].value,
			data[i - 1].value
		);
		// Current momentum (3-month forward)
		const currMomentum = calculateMomentum(data[i].value, data[i + 2].value);

		// Detect significant momentum shift
		const momentumShift = currMomentum - prevMomentum;

		if (Math.abs(momentumShift) >= MIN_MAGNITUDE_THRESHOLD) {
			const type = momentumShift > 0 ? 'acceleration' : 'deceleration';
			const direction = momentumShift > 0 ? 'accelerated' : 'slowed';

			changes.push({
				date: data[i].date,
				value: data[i].value,
				type,
				magnitude: Math.abs(momentumShift),
				description: `${metricLabel} momentum ${direction}`
			});
		}
	}

	return changes;
}

function calculateMomentum(startValue: number, endValue: number): number {
	if (startValue === 0) return 0;
	return ((endValue - startValue) / startValue) * 100;
}

function formatNumber(value: number): string {
	if (value >= 1000000) {
		return `$${(value / 1000000).toFixed(2)}M`;
	}
	if (value >= 1000) {
		return `$${(value / 1000).toFixed(0)}K`;
	}
	return value.toLocaleString();
}

export function getInflectionIcon(type: InflectionPoint['type']): string {
	switch (type) {
		case 'peak':
			return '▲';
		case 'trough':
			return '▼';
		case 'acceleration':
			return '⬆';
		case 'deceleration':
			return '⬇';
	}
}

export function getInflectionColor(type: InflectionPoint['type']): string {
	switch (type) {
		case 'peak':
			return '#ef4444'; // red - potential reversal down
		case 'trough':
			return '#22c55e'; // green - potential reversal up
		case 'acceleration':
			return '#3b82f6'; // blue - momentum increasing
		case 'deceleration':
			return '#f59e0b'; // amber - momentum decreasing
	}
}
