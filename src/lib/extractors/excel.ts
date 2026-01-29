import * as XLSX from 'xlsx';

export interface ExtractedMetric {
	metricTypeId: string;
	displayName: string;
	value: number;
	recordedDate: string;
	isOutlier: boolean;
	outlierReason?: string;
}

export interface ExtractionResult {
	success: boolean;
	metrics: ExtractedMetric[];
	warnings: string[];
	errors: string[];
}

// Column header mappings - case insensitive matching
const HEADER_MAPPINGS: Record<string, string[]> = {
	median_price: ['median sale price', 'median price', 'median home price', 'median sold price'],
	average_price: [
		'average price',
		'avg price',
		'average sale price',
		'avg sale price',
		'monthly sales price average',
		'monthly avg price'
	],
	price_per_sqft: ['price per sq ft', '$/sqft', 'price/sqft', 'price per square foot', 'ppsf'],
	active_listings: ['active listings', 'inventory', 'active inventory', 'listings', 'total active'],
	sales_count: ['number of sales', 'sales', 'closed sales', 'monthly sales', 'sales count'],
	days_on_market: ['days on market', 'dom', 'avg dom', 'average dom', 'average days on market'],
	months_of_supply: ['months of supply', 'absorption rate', 'months supply', 'mos'],
	list_to_sale_ratio: ['list to sale ratio', 'sp/lp ratio', 'sale to list', 'sp/lp', 'list-to-sale']
};

const DATE_HEADERS = ['date', 'period', 'month', 'year', 'time', 'report date'];

// Validation bounds for each metric type
const VALIDATION_BOUNDS: Record<string, { min: number; max: number; unit: string }> = {
	median_price: { min: 10000, max: 50000000, unit: 'USD' },
	average_price: { min: 10000, max: 50000000, unit: 'USD' },
	price_per_sqft: { min: 10, max: 5000, unit: 'USD' },
	active_listings: { min: 0, max: 100000, unit: 'count' },
	sales_count: { min: 0, max: 100000, unit: 'count' },
	days_on_market: { min: 0, max: 1000, unit: 'days' },
	months_of_supply: { min: 0, max: 36, unit: 'months' },
	list_to_sale_ratio: { min: 0.5, max: 1.5, unit: 'ratio' }
};

const DISPLAY_NAMES: Record<string, string> = {
	median_price: 'Median Sale Price',
	average_price: 'Average Sale Price',
	price_per_sqft: 'Price Per Sq Ft',
	active_listings: 'Active Listings',
	sales_count: 'Number of Sales',
	days_on_market: 'Days on Market',
	months_of_supply: 'Months of Supply',
	list_to_sale_ratio: 'List to Sale Ratio'
};

function normalizeHeader(header: string): string {
	return header.toLowerCase().trim().replace(/[_-]/g, ' ');
}

function isYtdHeader(header: string): boolean {
	const normalized = normalizeHeader(header);
	return normalized.includes('ytd');
}

function isMonthHeader(header: string): boolean {
	const normalized = normalizeHeader(header);
	return normalized === 'month' || normalized === 'report month';
}

function isYearHeader(header: string): boolean {
	const normalized = normalizeHeader(header);
	return normalized === 'year' || normalized === 'report year';
}

function mapHeaders(headers: string[]) {
	const headerMap: Record<string, string> = {};
	let dateColumn: string | null = null;
	let monthColumn: string | null = null;
	let yearColumn: string | null = null;

	for (const header of headers) {
		const normalizedHeader = normalizeHeader(header);
		if (!normalizedHeader) {
			continue;
		}
		if (isYtdHeader(header)) {
			continue;
		}
		if (isMonthHeader(header)) {
			monthColumn = header;
			continue;
		}
		if (isYearHeader(header)) {
			yearColumn = header;
			continue;
		}

		if (isDateHeader(header)) {
			dateColumn = header;
		} else {
			const metricType = findMetricType(header);
			if (metricType) {
				headerMap[header] = metricType;
			}
		}
	}

	return { headerMap, dateColumn, monthColumn, yearColumn };
}

function findMetricType(header: string): string | null {
	const normalized = normalizeHeader(header);
	for (const [metricType, aliases] of Object.entries(HEADER_MAPPINGS)) {
		if (aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
			return metricType;
		}
	}
	return null;
}

function isDateHeader(header: string): boolean {
	const normalized = normalizeHeader(header);
	return DATE_HEADERS.some((dh) => normalized.includes(dh) || dh.includes(normalized));
}

function parseDate(value: unknown): string | null {
	if (!value) return null;

	if (value instanceof Date && !isNaN(value.getTime())) {
		return value.toISOString().split('T')[0];
	}

	// Handle Excel serial dates
	if (typeof value === 'number') {
		const date = XLSX.SSF.parse_date_code(value);
		if (date) {
			return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
		}
	}

	// Handle string dates
	if (typeof value === 'string') {
		const str = value.trim();

		// Try ISO format first
		const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
		if (isoMatch) {
			return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
		}

		// Try MM/DD/YYYY or M/D/YYYY
		const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
		if (usMatch) {
			return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
		}

		// Try Month Year format (e.g., "January 2024", "Jan 2024")
		const monthYearMatch = str.match(/^([A-Za-z]+)\s+(\d{4})/);
		if (monthYearMatch) {
			const months: Record<string, string> = {
				jan: '01',
				january: '01',
				feb: '02',
				february: '02',
				mar: '03',
				march: '03',
				apr: '04',
				april: '04',
				may: '05',
				jun: '06',
				june: '06',
				jul: '07',
				july: '07',
				aug: '08',
				august: '08',
				sep: '09',
				september: '09',
				oct: '10',
				october: '10',
				nov: '11',
				november: '11',
				dec: '12',
				december: '12'
			};
			const month = months[monthYearMatch[1].toLowerCase()];
			if (month) {
				return `${monthYearMatch[2]}-${month}-01`;
			}
		}

		// Try to parse with Date constructor as fallback
		const parsed = new Date(str);
		if (!isNaN(parsed.getTime())) {
			return parsed.toISOString().split('T')[0];
		}
	}

	return null;
}

function parseMonthValue(value: unknown): string | null {
	if (typeof value === 'number' && value >= 1 && value <= 12) {
		return String(Math.trunc(value)).padStart(2, '0');
	}

	if (typeof value === 'string') {
		const trimmed = value.trim().toLowerCase();
		if (/^\d{1,2}$/.test(trimmed)) {
			const num = Number(trimmed);
			if (num >= 1 && num <= 12) {
				return String(num).padStart(2, '0');
			}
		}

		const months: Record<string, string> = {
			jan: '01',
			january: '01',
			feb: '02',
			february: '02',
			mar: '03',
			march: '03',
			apr: '04',
			april: '04',
			may: '05',
			jun: '06',
			june: '06',
			jul: '07',
			july: '07',
			aug: '08',
			august: '08',
			sep: '09',
			sept: '09',
			september: '09',
			oct: '10',
			october: '10',
			nov: '11',
			november: '11',
			dec: '12',
			december: '12'
		};

		return months[trimmed] ?? null;
	}

	return null;
}

function parseNumericValue(value: unknown): number | null {
	if (typeof value === 'number') {
		return value;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		// Handle parentheses for negatives
		const normalized = trimmed.startsWith('(') && trimmed.endsWith(')') ? `-${trimmed.slice(1, -1)}` : trimmed;
		// Remove anything that's not digit, decimal point, or minus
		const cleaned = normalized.replace(/[^0-9.-]/g, '');
		const num = parseFloat(cleaned);
		if (!isNaN(num)) {
			// If it was a percentage, convert to decimal
			if (value.includes('%')) {
				return num / 100;
			}
			return num;
		}
	}

	return null;
}

function validateMetric(
	metricTypeId: string,
	value: number
): { isOutlier: boolean; reason?: string } {
	const bounds = VALIDATION_BOUNDS[metricTypeId];
	if (!bounds) {
		return { isOutlier: false };
	}

	if (value < bounds.min) {
		return {
			isOutlier: true,
			reason: `Value ${value} is below minimum expected (${bounds.min} ${bounds.unit})`
		};
	}

	if (value > bounds.max) {
		return {
			isOutlier: true,
			reason: `Value ${value} is above maximum expected (${bounds.max} ${bounds.unit})`
		};
	}

	return { isOutlier: false };
}

export function extractFromFile(file: ArrayBuffer): ExtractionResult {
	const result: ExtractionResult = {
		success: false,
		metrics: [],
		warnings: [],
		errors: []
	};

	try {
		const workbook = XLSX.read(file, { type: 'array', cellDates: true });

		if (workbook.SheetNames.length === 0) {
			result.errors.push('No sheets found in the file');
			return result;
		}

		// Use the first sheet
		const sheetName = workbook.SheetNames[0];
		const sheet = workbook.Sheets[sheetName];

		// Convert to JSON with headers
		let data = XLSX.utils.sheet_to_json(sheet, { defval: null });

		if (data.length === 0) {
			result.errors.push('No data found in the sheet');
			return result;
		}

		// Get headers from first row
		let headers = Object.keys(data[0] as object);
		let { headerMap, dateColumn, monthColumn, yearColumn } = mapHeaders(headers);

		if (Object.keys(headerMap).length === 0) {
			const rawRows = XLSX.utils.sheet_to_json(sheet, {
				header: 1,
				defval: null,
				blankrows: false
			}) as unknown[][];

			let bestRowIndex: number | null = null;
			let bestScore = 0;
			let bestHeaders: string[] | null = null;
			let bestMapping: ReturnType<typeof mapHeaders> | null = null;

			for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
				const row = rawRows[i];
				if (!row) continue;
				const candidateHeaders = row.map((cell) =>
					cell === null || cell === undefined ? '' : String(cell).trim()
				);
				if (candidateHeaders.length === 0) continue;

				const mapping = mapHeaders(candidateHeaders);
				const score =
					Object.keys(mapping.headerMap).length +
					(mapping.dateColumn ? 1 : 0) +
					(mapping.monthColumn && mapping.yearColumn ? 1 : 0);

				if (score > bestScore) {
					bestScore = score;
					bestRowIndex = i;
					bestHeaders = candidateHeaders;
					bestMapping = mapping;
				}
			}

				if (bestRowIndex !== null && bestHeaders && bestMapping && bestScore > 0) {
					headers = bestHeaders;
					headerMap = bestMapping.headerMap;
					dateColumn = bestMapping.dateColumn;
					monthColumn = bestMapping.monthColumn;
					yearColumn = bestMapping.yearColumn;

					data = rawRows.slice(bestRowIndex + 1).map((row) => {
						const entry: Record<string, unknown> = {};
						for (let idx = 0; idx < headers.length; idx++) {
							const header = headers[idx];
							if (!header) continue;
							entry[header] = row?.[idx] ?? null;
						}
						return entry;
					});
				}
		}

		if (!dateColumn && !(monthColumn && yearColumn)) {
			result.warnings.push('No date column found - using current date as default');
		}

		if (Object.keys(headerMap).length === 0) {
			result.errors.push(
				'No recognizable metric columns found. Expected columns like: Median Price, Days on Market, Active Listings, etc.'
			);
			return result;
		}

		// Process each row
		for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
			const row = data[rowIdx] as Record<string, unknown>;

			// Get date for this row
			let recordedDate: string;
			if (monthColumn && yearColumn && row[monthColumn] && row[yearColumn]) {
				const parsedMonth = parseMonthValue(row[monthColumn]);
				const parsedYear = parseNumericValue(row[yearColumn]);
				if (parsedMonth && parsedYear && parsedYear >= 1000) {
					recordedDate = `${Math.trunc(parsedYear)}-${parsedMonth}-01`;
				} else {
					result.warnings.push(
						`Row ${rowIdx + 2}: Could not parse month/year "${row[monthColumn]}" "${row[yearColumn]}"`
					);
					continue;
				}
			} else if (dateColumn && row[dateColumn]) {
				const parsed = parseDate(row[dateColumn]);
				if (parsed) {
					recordedDate = parsed;
				} else {
					result.warnings.push(`Row ${rowIdx + 2}: Could not parse date "${row[dateColumn]}"`);
					continue;
				}
			} else {
				// Default to first of current month
				const now = new Date();
				recordedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
			}

			// Extract metrics from this row
			for (const [header, metricTypeId] of Object.entries(headerMap)) {
				const rawValue = row[header];
				if (rawValue === null || rawValue === undefined || rawValue === '') {
					continue;
				}

				const value = parseNumericValue(rawValue);
				if (value === null) {
					result.warnings.push(
						`Row ${rowIdx + 2}: Could not parse value "${rawValue}" for ${header}`
					);
					continue;
				}

				const validation = validateMetric(metricTypeId, value);

				result.metrics.push({
					metricTypeId,
					displayName: DISPLAY_NAMES[metricTypeId] || metricTypeId,
					value,
					recordedDate,
					isOutlier: validation.isOutlier,
					outlierReason: validation.reason
				});
			}
		}

		if (result.metrics.length > 0) {
			result.success = true;
		} else {
			result.errors.push('No valid metrics could be extracted from the file');
		}
	} catch (error) {
		result.errors.push(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}

	return result;
}

export function getMetricTypes() {
	return Object.entries(DISPLAY_NAMES).map(([id, displayName]) => ({
		id,
		displayName,
		...VALIDATION_BOUNDS[id]
	}));
}
