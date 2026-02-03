import type { ApexOptions } from 'apexcharts';
import { getFedEventsInRange, getFedEventColor, type FedRateEvent } from '$lib/data/fed-rates';
import { detectInflectionPoints, getInflectionColor, type DataPoint, type InflectionPoint } from '$lib/insights/inflection-detector';

export interface UserAnnotation {
	id: number;
	annotation_date: string;
	metric_type_id: string | null;
	label: string;
	description: string | null;
	category: 'fed_rate' | 'local_event' | 'market_event' | 'custom';
	color: string;
	is_auto_generated: boolean;
}

export interface AnnotationConfig {
	showFedRates: boolean;
	showInflectionPoints: boolean;
	metricTypeId?: string;
	metricLabel?: string;
}

export function buildChartAnnotations(
	data: DataPoint[],
	userAnnotations: UserAnnotation[],
	config: AnnotationConfig
): ApexOptions['annotations'] {
	if (data.length === 0) {
		return undefined;
	}

	const sorted = [...data].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	const startDate = sorted[0].date;
	const endDate = sorted[sorted.length - 1].date;

	const xaxis: ApexXAxisAnnotation[] = [];
	const points: ApexAnnotationsPoint[] = [];

	// 1. Add Fed rate events as point markers on the data line
	if (config.showFedRates) {
		const fedEvents = getFedEventsInRange(startDate, endDate);
		for (const event of fedEvents) {
			const fedPoint = buildFedRatePointAnnotation(event, sorted);
			if (fedPoint) {
				points.push(fedPoint);
			}
		}
	}

	// 2. Add user annotations
	for (const annotation of userAnnotations) {
		// Skip if annotation is for a different metric type
		if (
			annotation.metric_type_id !== null &&
			config.metricTypeId &&
			annotation.metric_type_id !== config.metricTypeId
		) {
			continue;
		}

		xaxis.push(buildUserAnnotation(annotation));
	}

	// 3. Add inflection points
	if (config.showInflectionPoints && data.length >= 5) {
		const inflections = detectInflectionPoints(data, config.metricLabel);
		for (const inflection of inflections) {
			points.push(buildInflectionAnnotation(inflection, data));
		}
	}

	return {
		xaxis,
		points
	};
}

// Find Y value from data at or near a given date
function findYValueAtDate(date: string, data: DataPoint[]): number | null {
	const targetTime = new Date(date).getTime();

	// First try exact match
	const exactMatch = data.find(d => d.date === date);
	if (exactMatch) return exactMatch.value;

	// Find closest data point
	let closest: DataPoint | null = null;
	let closestDiff = Infinity;

	for (const point of data) {
		const pointTime = new Date(point.date).getTime();
		const diff = Math.abs(pointTime - targetTime);
		if (diff < closestDiff) {
			closestDiff = diff;
			closest = point;
		}
	}

	// Only use if within 45 days
	if (closest && closestDiff <= 45 * 24 * 60 * 60 * 1000) {
		return closest.value;
	}

	return null;
}

// Build Fed rate as a point annotation (colored dot on the chart line)
// Red = rate hike, Green = rate cut, Gray = no change
function buildFedRatePointAnnotation(
	event: FedRateEvent,
	data: DataPoint[]
): ApexAnnotationsPoint | null {
	const yValue = findYValueAtDate(event.date, data);
	if (yValue === null) return null;

	const color = getFedEventColor(event);

	return {
		x: new Date(`${event.date}T12:00:00`).getTime(),
		y: yValue,
		marker: {
			size: 5,
			fillColor: color,
			strokeColor: '#0c0c0c',
			strokeWidth: 2,
			shape: 'circle',
			cssClass: 'fed-rate-marker'
		}
	};
}

function buildUserAnnotation(annotation: UserAnnotation): ApexXAxisAnnotation {
	return {
		x: new Date(`${annotation.annotation_date}T12:00:00`).getTime(),
		strokeDashArray: 0,
		borderColor: annotation.color,
		borderWidth: 2,
		opacity: 0.9,
		label: {
			text: annotation.label,
			borderColor: annotation.color,
			style: {
				color: '#fff',
				background: annotation.color,
				fontSize: '10px',
				fontWeight: 600,
				padding: {
					left: 6,
					right: 6,
					top: 3,
					bottom: 3
				}
			},
			position: 'top',
			orientation: 'horizontal'
		}
	};
}

function buildInflectionAnnotation(
	inflection: InflectionPoint,
	data: DataPoint[]
): ApexAnnotationsPoint {
	const color = getInflectionColor(inflection.type);

	// Find the actual value at this date
	const dataPoint = data.find((d) => d.date === inflection.date);
	const yValue = dataPoint?.value ?? inflection.value;

	return {
		x: new Date(`${inflection.date}T12:00:00`).getTime(),
		y: yValue,
		marker: {
			size: 6,
			fillColor: color,
			strokeColor: '#0c0c0c',
			strokeWidth: 2,
			shape: 'circle',
			cssClass: 'inflection-marker'
		},
		label: {
			text: getInflectionLabel(inflection.type),
			borderColor: color,
			style: {
				color: '#fff',
				background: color,
				fontSize: '9px',
				fontWeight: 600,
				padding: {
					left: 4,
					right: 4,
					top: 2,
					bottom: 2
				}
			},
			offsetY: -8
		}
	};
}

function getInflectionLabel(type: InflectionPoint['type']): string {
	switch (type) {
		case 'peak':
			return 'Peak';
		case 'trough':
			return 'Trough';
		case 'acceleration':
			return 'Accel';
		case 'deceleration':
			return 'Decel';
	}
}

// Type definitions for ApexCharts annotations
interface ApexXAxisAnnotation {
	x: number;
	x2?: number;
	strokeDashArray?: number;
	borderColor?: string;
	borderWidth?: number;
	opacity?: number;
	label?: {
		text: string;
		borderColor?: string;
		style?: {
			color?: string;
			background?: string;
			fontSize?: string;
			fontWeight?: number;
			padding?: {
				left?: number;
				right?: number;
				top?: number;
				bottom?: number;
			};
		};
		position?: 'top' | 'bottom';
		orientation?: 'horizontal' | 'vertical';
		offsetX?: number;
		offsetY?: number;
	};
}

interface ApexAnnotationsPoint {
	x: number;
	y: number;
	marker?: {
		size?: number;
		fillColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		shape?: string;
		cssClass?: string;
	};
	label?: {
		text: string;
		borderColor?: string;
		style?: {
			color?: string;
			background?: string;
			fontSize?: string;
			fontWeight?: number;
			padding?: {
				left?: number;
				right?: number;
				top?: number;
				bottom?: number;
			};
		};
		offsetX?: number;
		offsetY?: number;
	};
}

export const ANNOTATION_COLORS = [
	{ value: '#d4a853', label: 'Gold' },
	{ value: '#3b82f6', label: 'Blue' },
	{ value: '#22c55e', label: 'Green' },
	{ value: '#ef4444', label: 'Red' },
	{ value: '#a78bfa', label: 'Purple' }
];

export const ANNOTATION_CATEGORIES = [
	{ value: 'local_event', label: 'Local Event' },
	{ value: 'market_event', label: 'Market Event' },
	{ value: 'custom', label: 'Custom' }
] as const;
