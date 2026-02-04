import html2canvas from 'html2canvas';

export interface ExportOptions {
	scale?: number;
	filename?: string;
}

export type ExportQuality = 'web' | 'presentation' | 'print';

const SCALE_MAP: Record<ExportQuality, number> = {
	web: 2,
	presentation: 3,
	print: 4
};

/**
 * Export a styled container element as a PNG image using html2canvas.
 * The container should include all branding/styling elements for the export.
 */
export async function exportChartAsImage(
	container: HTMLElement,
	options: ExportOptions = {}
): Promise<void> {
	const { scale = SCALE_MAP.presentation, filename = 'chart-export' } = options;

	const canvas = await html2canvas(container, {
		scale,
		backgroundColor: null,
		useCORS: true,
		logging: false
	});

	const link = document.createElement('a');
	link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
	link.href = canvas.toDataURL('image/png');
	link.click();
}

/**
 * Get the scale factor for a given quality preset.
 */
export function getScaleForQuality(quality: ExportQuality): number {
	return SCALE_MAP[quality];
}
