import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_SINGLE_USER_ID } from '$env/static/private';

export const load: PageServerLoad = async () => {
	return { user: null };
};

interface MetricInput {
	metricTypeId: string;
	value: number;
	recordedDate: string;
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
	default: async ({ request, locals: { supabaseAdmin } }) => {
		const formData = await request.formData();
		const metricsJson = formData.get('metrics') as string;

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

		return { success: true };
	}
};
