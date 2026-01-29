import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_SINGLE_USER_ID } from '$env/static/private';

const METRIC_TYPE_IDS = [
	'median_price',
	'average_price',
	'price_per_sqft',
	'active_listings',
	'sales_count',
	'days_on_market',
	'months_of_supply',
	'list_to_sale_ratio'
];

export const load: PageServerLoad = async () => {
	return { user: null };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabaseAdmin } }) => {
		const formData = await request.formData();
		const recordedDateInput = formData.get('recordedDate') as string;

		if (!recordedDateInput) {
			return fail(400, { error: 'Report month is required' });
		}

		// Convert YYYY-MM to YYYY-MM-01
		const recordedDate = `${recordedDateInput}-01`;

		// Collect metrics with values
		const metricsToInsert = [];

		for (const metricTypeId of METRIC_TYPE_IDS) {
			const value = formData.get(metricTypeId) as string;
			if (value && value.trim() !== '') {
				const numValue = parseFloat(value);
				if (!isNaN(numValue)) {
					metricsToInsert.push({
						user_id: PRIVATE_SINGLE_USER_ID,
						metric_type_id: metricTypeId,
						recorded_date: recordedDate,
						value: numValue,
						is_manually_entered: true
					});
				}
			}
		}

		if (metricsToInsert.length === 0) {
			return fail(400, { error: 'Please enter at least one metric value' });
		}

		// Upsert metrics
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
