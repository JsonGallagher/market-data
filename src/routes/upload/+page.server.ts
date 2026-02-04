import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_SINGLE_USER_ID } from '$env/static/private';
import { generateAIInsights, type MarketSummary } from '$lib/ai/openai-insights';
import { requireAuth } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const { locals: { supabaseAdmin } } = event;

	// Fetch recent import sources
	const { data: importSources, error } = await supabaseAdmin
		.from('import_sources')
		.select('*')
		.eq('user_id', PRIVATE_SINGLE_USER_ID)
		.order('last_imported_at', { ascending: false })
		.limit(10);

	if (error) {
		console.error('Failed to fetch import sources:', error);
	}

	return {
		importSources: importSources ?? []
	};
};

interface MetricInput {
	metricTypeId: string;
	value: number;
	recordedDate: string;
}

interface ImportSourceInput {
	type: 'google_sheets' | 'csv' | 'excel';
	url: string | null;
	name: string;
	sheetTab: string | null;
}

const ALLOWED_METRIC_TYPE_IDS = new Set([
	'median_price',
	'average_price',
	'price_per_sqft',
	'active_listings',
	'sales_count',
	'days_on_market',
	'months_of_supply',
	'list_to_sale_ratio'
]);

function isValidRecordedDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const actions: Actions = {
	default: async (event) => {
		requireAuth(event);
		const { request, locals: { supabaseAdmin }, platform } = event;

		const formData = await request.formData();
		const metricsJson = formData.get('metrics') as string;
		const importSourceJson = formData.get('importSource') as string | null;

		if (!metricsJson) {
			return fail(400, { error: 'No metrics data provided' });
		}

		let metrics: MetricInput[];
		try {
			metrics = JSON.parse(metricsJson);
		} catch {
			return fail(400, { error: 'Invalid metrics data' });
		}

		if (!Array.isArray(metrics) || metrics.length === 0) {
			return fail(400, { error: 'No metrics to save' });
		}

		for (const metric of metrics) {
			if (!ALLOWED_METRIC_TYPE_IDS.has(metric.metricTypeId)) {
				return fail(400, { error: `Unsupported metric type: ${metric.metricTypeId}` });
			}
			if (!isValidRecordedDate(metric.recordedDate)) {
				return fail(400, { error: `Invalid recorded date: ${metric.recordedDate}` });
			}
			if (!Number.isFinite(metric.value)) {
				return fail(400, { error: `Invalid value for ${metric.metricTypeId}` });
			}
		}

		// Prepare data for upsert
		const metricsToInsert = metrics.map((m) => ({
			user_id: PRIVATE_SINGLE_USER_ID,
			metric_type_id: m.metricTypeId,
			recorded_date: m.recordedDate,
			value: m.value,
			is_manually_entered: false
		}));

		// Upsert metrics (update if exists for same user/metric/date)
		const { error } = await supabaseAdmin.from('metrics').upsert(metricsToInsert, {
			onConflict: 'user_id,metric_type_id,recorded_date'
		});

		if (error) {
			console.error('Failed to save metrics:', error);
			return fail(500, { error: 'Failed to save metrics: ' + error.message });
		}

		// Save import source if provided
		if (importSourceJson) {
			try {
				const importSource: ImportSourceInput = JSON.parse(importSourceJson);
				const now = new Date().toISOString();

				if (importSource.type === 'google_sheets' && importSource.url) {
					// For Google Sheets, check if record exists and update, or insert
					const { data: existing } = await supabaseAdmin
						.from('import_sources')
						.select('id')
						.eq('user_id', PRIVATE_SINGLE_USER_ID)
						.eq('source_url', importSource.url)
						.single();

					if (existing) {
						// Update existing record
						const { error: updateError } = await supabaseAdmin
							.from('import_sources')
							.update({
								last_imported_at: now,
								row_count: metrics.length,
								sheet_tab: importSource.sheetTab
							})
							.eq('id', existing.id);

						if (updateError) {
							console.error('Failed to update import source:', updateError);
						}
					} else {
						// Insert new record
						const { error: insertError } = await supabaseAdmin.from('import_sources').insert({
							user_id: PRIVATE_SINGLE_USER_ID,
							source_type: importSource.type,
							source_url: importSource.url,
							source_name: importSource.name,
							sheet_tab: importSource.sheetTab,
							last_imported_at: now,
							row_count: metrics.length
						});

						if (insertError) {
							console.error('Failed to save import source:', insertError);
						}
					}
				} else {
					// For file uploads, always insert a new record
					const { error: insertError } = await supabaseAdmin.from('import_sources').insert({
						user_id: PRIVATE_SINGLE_USER_ID,
						source_type: importSource.type,
						source_url: importSource.url,
						source_name: importSource.name,
						sheet_tab: importSource.sheetTab,
						last_imported_at: now,
						row_count: metrics.length
					});

					if (insertError) {
						console.error('Failed to save import source:', insertError);
					}
				}
			} catch (e) {
				console.error('Failed to parse import source:', e);
			}
		}

		// Generate and cache AI insights in background (don't block response)
		// Use waitUntil for Cloudflare Workers to ensure the promise completes
		const insightsPromise = generateAndCacheInsights(supabaseAdmin);
		if (platform?.ctx) {
			platform.ctx.waitUntil(insightsPromise.catch(console.error));
		} else {
			insightsPromise.catch(console.error);
		}

		return { success: true };
	}
};

type DateRange = '6m' | '12m' | '24m' | '5y' | 'all';

function getCutoffDate(range: DateRange): Date | null {
	if (range === 'all') return null;

	const now = new Date();
	switch (range) {
		case '6m':
			return new Date(now.getFullYear(), now.getMonth() - 6, 1);
		case '12m':
			return new Date(now.getFullYear() - 1, now.getMonth(), 1);
		case '24m':
			return new Date(now.getFullYear() - 2, now.getMonth(), 1);
		case '5y':
			return new Date(now.getFullYear() - 5, now.getMonth(), 1);
		default:
			return null;
	}
}

async function generateAndCacheInsights(supabaseAdmin: any) {
	console.log('[AI Insights] Starting generation...');

	// Fetch all data for insights generation
	const { data: allMetricsData } = await supabaseAdmin
		.from('metrics')
		.select('*')
		.eq('user_id', PRIVATE_SINGLE_USER_ID)
		.order('recorded_date', { ascending: false });

	if (!allMetricsData || allMetricsData.length === 0) {
		console.log('[AI Insights] No metrics data found');
		return;
	}

	console.log(`[AI Insights] Found ${allMetricsData.length} metrics`);

	// Generate insights only for 12 months - this provides the best balance of
	// recency and trend data for actionable real estate insights
	const range: DateRange = '12m';
	const cutoffDate = getCutoffDate(range);

	// Filter metrics for 12 month range
	const metricsData = cutoffDate
		? allMetricsData.filter((m: any) => new Date(m.recorded_date) >= cutoffDate)
		: allMetricsData;

	if (metricsData.length === 0) return;

	// Build metrics by date map
	const metricsByDate: Record<string, Record<string, number>> = {};
	for (const m of metricsData) {
		if (!metricsByDate[m.recorded_date]) {
			metricsByDate[m.recorded_date] = {};
		}
		metricsByDate[m.recorded_date][m.metric_type_id] = m.value;
	}

	const sortedDates = Object.keys(metricsByDate).sort();
	const latestDate = sortedDates[sortedDates.length - 1];
	const latestData = metricsByDate[latestDate] || {};

	// For YoY comparison, find the date from 12 months ago
	const priorYearDate = new Date(latestDate);
	priorYearDate.setFullYear(priorYearDate.getFullYear() - 1);
	const priorYearStr = priorYearDate.toISOString().split('T')[0];
	const priorYearData = metricsByDate[priorYearStr] || metricsByDate[sortedDates[0]] || {};

	const calcChange = (current: number | null, prior: number | null) => {
		if (current === null || prior === null || prior === 0) return null;
		return ((current - prior) / prior) * 100;
	};

	const summary: MarketSummary = {
		latestDate: new Date(latestDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
		medianPrice: {
			current: latestData.median_price ?? null,
			yoyChange: calcChange(latestData.median_price, priorYearData.median_price)
		},
		averagePrice: {
			current: latestData.average_price ?? null,
			yoyChange: calcChange(latestData.average_price, priorYearData.average_price)
		},
		salesCount: {
			current: latestData.sales_count ?? null,
			yoyChange: calcChange(latestData.sales_count, priorYearData.sales_count)
		},
		activeListings: {
			current: latestData.active_listings ?? null,
			yoyChange: calcChange(latestData.active_listings, priorYearData.active_listings)
		},
		daysOnMarket: {
			current: latestData.days_on_market ?? null,
			yoyChange: calcChange(latestData.days_on_market, priorYearData.days_on_market)
		},
		monthsOfSupply: latestData.active_listings && latestData.sales_count
			? latestData.active_listings / latestData.sales_count
			: null,
		pricePerSqft: {
			current: latestData.price_per_sqft ?? null,
			yoyChange: calcChange(latestData.price_per_sqft, priorYearData.price_per_sqft)
		}
	};

	const result = await generateAIInsights(summary);

	console.log(`[AI Insights] Generated ${result.insights.length} insights`);
	console.log('[AI Insights] targetAudience values:', result.insights.map(i => i.targetAudience));

	if (result.insights.length > 0 || result.marketCondition) {
		// Cache insights for the 12m range
		const { error: upsertError } = await supabaseAdmin
			.from('ai_insights')
			.upsert({
				user_id: PRIVATE_SINGLE_USER_ID,
				date_range: range,
				insights: result.insights,
				market_condition: result.marketCondition,
				generated_at: new Date().toISOString()
			}, { onConflict: 'user_id,date_range' });

		if (upsertError) {
			console.error('[AI Insights] Failed to cache:', upsertError);
		} else {
			console.log('[AI Insights] Successfully cached insights');
		}
	}
}
