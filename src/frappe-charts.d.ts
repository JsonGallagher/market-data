declare module 'frappe-charts' {
	interface ChartOptions {
		title?: string;
		data: {
			labels: string[];
			datasets: Array<{
				name: string;
				values: number[];
			}>;
		};
		type: 'line' | 'bar' | 'axis-mixed' | 'pie' | 'percentage' | 'heatmap';
		height?: number;
		colors?: string[];
		lineOptions?: {
			regionFill?: number;
			hideDots?: number;
			dotSize?: number;
			spline?: number;
		};
		axisOptions?: {
			xAxisMode?: 'span' | 'tick';
			xIsSeries?: boolean;
		};
		tooltipOptions?: {
			formatTooltipX?: (value: string) => string;
			formatTooltipY?: (value: number) => string;
		};
	}

	export class Chart {
		constructor(element: HTMLElement, options: ChartOptions);
		destroy(): void;
	}
}
