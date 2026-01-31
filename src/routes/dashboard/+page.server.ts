import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_SINGLE_USER_ID } from '$env/static/private';

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

export const load: PageServerLoad = async ({ url, locals: { supabaseAdmin } }) => {
	// Get date range from URL param, default to 12 months
	const rangeParam = url.searchParams.get('range');
	const range: DateRange = isValidRange(rangeParam) ? rangeParam : '12m';
	const cutoffDate = getCutoffDate(range);

	// Build query with optional date filter
	let query = supabaseAdmin
		.from('metrics')
		.select('*')
		.eq('user_id', PRIVATE_SINGLE_USER_ID);

	if (cutoffDate) {
		query = query.gte('recorded_date', cutoffDate.toISOString().split('T')[0]);
	}

	const { data: metrics, error: metricsError } = await query.order('recorded_date', {
		ascending: false
	});

	if (metricsError) {
		console.error('Failed to fetch metrics:', metricsError);
	}

	// Fetch metric types for display names
	const { data: metricTypes, error: typesError } = await supabaseAdmin
		.from('metric_types')
		.select('*');

	if (typesError) {
		console.error('Failed to fetch metric types:', typesError);
	}

	// Fetch user's shared links
	const { data: sharedLinks, error: linksError } = await supabaseAdmin
		.from('shared_links')
		.select('*')
		.eq('user_id', PRIVATE_SINGLE_USER_ID);

	if (linksError) {
		console.error('Failed to fetch shared links:', linksError);
	}

	// Fetch last import timestamp
	const { data: lastImport } = await supabaseAdmin
		.from('import_sources')
		.select('last_imported_at, source_name')
		.eq('user_id', PRIVATE_SINGLE_USER_ID)
		.order('last_imported_at', { ascending: false })
		.limit(1)
		.single();

	return {
		user: null,
		metrics: metrics ?? [],
		metricTypes: metricTypes ?? [],
		sharedLinks: sharedLinks ?? [],
		range,
		lastImport: lastImport ?? null
	};
};

export const actions: Actions = {
	createLink: async ({ locals: { supabaseAdmin } }) => {
		const { error } = await supabaseAdmin.from('shared_links').insert({
			user_id: PRIVATE_SINGLE_USER_ID
		});

		if (error) {
			console.error('Failed to create link:', error);
			return fail(500, { error: 'Failed to create shareable link' });
		}

		return { success: true };
	},

	deleteLink: async ({ request, locals: { supabaseAdmin } }) => {
		const formData = await request.formData();
		const linkId = formData.get('linkId') as string;

		if (!linkId) {
			return fail(400, { error: 'Link ID is required' });
		}

		const { error } = await supabaseAdmin
			.from('shared_links')
			.delete()
			.eq('id', linkId)
			.eq('user_id', PRIVATE_SINGLE_USER_ID);

		if (error) {
			console.error('Failed to delete link:', error);
			return fail(500, { error: 'Failed to delete link' });
		}

		return { success: true };
	}
};
