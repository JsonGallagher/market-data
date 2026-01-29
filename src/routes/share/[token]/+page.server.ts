import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabaseAdmin } }) => {
	const { token } = params;

	// Find the shared link
	const { data: link, error: linkError } = await supabaseAdmin
		.from('shared_links')
		.select('user_id')
		.eq('token', token)
		.single();

	if (linkError || !link) {
		error(404, 'Shared link not found or has been deleted');
	}

	// Fetch metrics for the link owner
	const { data: metrics, error: metricsError } = await supabaseAdmin
		.from('metrics')
		.select('*')
		.eq('user_id', link.user_id)
		.order('recorded_date', { ascending: false });

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
		ownerName: profile?.full_name || 'Market Professional'
	};
};
