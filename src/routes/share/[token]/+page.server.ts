import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type DateRange = '6m' | '12m' | '24m' | 'all';

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
		default:
			return null;
	}
}

function isValidRange(value: string | null): value is DateRange {
	return value === '6m' || value === '12m' || value === '24m' || value === 'all';
}

export const load: PageServerLoad = async ({ params, url, locals: { supabaseAdmin } }) => {
	const { token } = params;

	// Get date range from URL param, default to 12 months
	const rangeParam = url.searchParams.get('range');
	const range: DateRange = isValidRange(rangeParam) ? rangeParam : '12m';
	const cutoffDate = getCutoffDate(range);

	// Find the shared link
	const { data: link, error: linkError } = await supabaseAdmin
		.from('shared_links')
		.select('user_id')
		.eq('token', token)
		.single();

	if (linkError || !link) {
		error(404, 'Shared link not found or has been deleted');
	}

	// Build query with optional date filter
	let query = supabaseAdmin
		.from('metrics')
		.select('*')
		.eq('user_id', link.user_id);

	if (cutoffDate) {
		query = query.gte('recorded_date', cutoffDate.toISOString().split('T')[0]);
	}

	const { data: metrics, error: metricsError } = await query.order('recorded_date', {
		ascending: false
	});

	if (metricsError) {
		console.error('Failed to fetch metrics:', metricsError);
		error(500, 'Failed to load dashboard data');
	}

	// Fetch metric types
	const { data: metricTypes, error: typesError } = await supabaseAdmin
		.from('metric_types')
		.select('*');

	if (typesError) {
		console.error('Failed to fetch metric types:', typesError);
	}

	// Fetch owner profile for attribution
	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('full_name')
		.eq('id', link.user_id)
		.single();

	return {
		metrics: metrics ?? [],
		metricTypes: metricTypes ?? [],
		ownerName: profile?.full_name || 'Market Professional',
		range
	};
};
