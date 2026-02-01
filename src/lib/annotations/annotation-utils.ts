import type { ApexOptions } from 'apexcharts';
import { getFedEventsInRange, getFedEventColor, formatFedRateChange, type FedRateEvent } from '$lib/data/fed-rates';
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

	// 1. Add Fed rate events
	if (config.showFedRates) {
		const fedEvents = getFedEventsInRange(startDate, endDate);
		for (const event of fedEvents) {
			xaxis.push(buildFedRateAnnotation(event));
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

function buildFedRateAnnotation(event: FedRateEvent): ApexXAxisAnnotation {
	const color = getFedEventColor(event);
	const changeText = formatFedRateChange(event.change);

	return {
		x: new Date(`${event.date}T12:00:00`).getTime(),
		strokeDashArray: 4,
		borderColor: color,
		borderWidth: 1,
		opacity: 0.7,
		label: {
			text: `Fed ${changeText}`,
			borderColor: color,
			style: {
				color: '#fff',
				background: color,
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
