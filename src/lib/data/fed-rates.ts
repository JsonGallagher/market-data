export interface FedRateEvent {
	date: string; // YYYY-MM-DD
	rate: number; // Target rate upper bound (e.g., 5.50 for 5.25-5.50%)
	change: number; // Basis points change (e.g., 25, -50)
	description: string;
	type: 'hike' | 'cut' | 'emergency';
}

// Federal Reserve rate decisions 2020-2026
// Source: Federal Reserve FOMC statements
export const FED_RATE_EVENTS: FedRateEvent[] = [
	// 2020 - Emergency cuts during COVID
	{
		date: '2020-03-03',
		rate: 1.25,
		change: -50,
		description: 'Emergency cut - COVID-19 response',
		type: 'emergency'
	},
	{
		date: '2020-03-15',
		rate: 0.25,
		change: -100,
		description: 'Emergency cut to near-zero',
		type: 'emergency'
	},

	// 2022 - Hiking cycle begins
	{
		date: '2022-03-16',
		rate: 0.50,
		change: 25,
		description: 'First hike since 2018',
		type: 'hike'
	},
	{
		date: '2022-05-04',
		rate: 1.00,
		change: 50,
		description: 'Inflation concerns rise',
		type: 'hike'
	},
	{
		date: '2022-06-15',
		rate: 1.75,
		change: 75,
		description: 'Largest hike since 1994',
		type: 'hike'
	},
	{
		date: '2022-07-27',
		rate: 2.50,
		change: 75,
		description: 'Continued aggressive tightening',
		type: 'hike'
	},
	{
		date: '2022-09-21',
		rate: 3.25,
		change: 75,
		description: 'Third consecutive 75bp hike',
		type: 'hike'
	},
	{
		date: '2022-11-02',
		rate: 4.00,
		change: 75,
		description: 'Fourth consecutive 75bp hike',
		type: 'hike'
	},
	{
		date: '2022-12-14',
		rate: 4.50,
		change: 50,
		description: 'Pace of hikes slows',
		type: 'hike'
	},

	// 2023 - Final hikes
	{
		date: '2023-02-01',
		rate: 4.75,
		change: 25,
		description: 'Continued tightening',
		type: 'hike'
	},
	{
		date: '2023-03-22',
		rate: 5.00,
		change: 25,
		description: 'Hike despite banking stress',
		type: 'hike'
	},
	{
		date: '2023-05-03',
		rate: 5.25,
		change: 25,
		description: 'May be final hike',
		type: 'hike'
	},
	{
		date: '2023-07-26',
		rate: 5.50,
		change: 25,
		description: 'Highest level since 2001',
		type: 'hike'
	},

	// 2024 - Rate cuts begin
	{
		date: '2024-09-18',
		rate: 5.00,
		change: -50,
		description: 'First cut since 2020',
		type: 'cut'
	},
	{
		date: '2024-11-07',
		rate: 4.75,
		change: -25,
		description: 'Continued easing',
		type: 'cut'
	},
	{
		date: '2024-12-18',
		rate: 4.50,
		change: -25,
		description: 'Year-end cut',
		type: 'cut'
	},

	// 2025 - Continued easing (projected/actual)
	{
		date: '2025-01-29',
		rate: 4.50,
		change: 0,
		description: 'No change - watching data',
		type: 'cut' // Placeholder for pause
	}
];

export function getFedEventsInRange(
	startDate: string,
	endDate: string
): FedRateEvent[] {
	const start = new Date(startDate);
	const end = new Date(endDate);

	return FED_RATE_EVENTS.filter((event) => {
		const eventDate = new Date(event.date);
		return eventDate >= start && eventDate <= end;
	});
}

export function getLatestFedRate(asOfDate?: string): FedRateEvent | null {
	const targetDate = asOfDate ? new Date(asOfDate) : new Date();

	const pastEvents = FED_RATE_EVENTS.filter(
		(event) => new Date(event.date) <= targetDate
	);

	if (pastEvents.length === 0) return null;

	return pastEvents[pastEvents.length - 1];
}

export function getFedEventColor(event: FedRateEvent): string {
	if (event.type === 'emergency') return '#ef4444'; // red
	if (event.change > 0) return '#ef4444'; // red for hikes
	if (event.change < 0) return '#22c55e'; // green for cuts
	return '#a0a0a0'; // gray for no change
}

export function formatFedRateChange(change: number): string {
	if (change === 0) return 'No change';
	const sign = change > 0 ? '+' : '';
	return `${sign}${change}bp`;
}
