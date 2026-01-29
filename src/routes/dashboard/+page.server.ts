import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_SINGLE_USER_ID } from '$env/static/private';

export const load: PageServerLoad = async ({ locals: { supabaseAdmin } }) => {
	// Fetch all metrics for the user
	const { data: metrics, error: metricsError } = await supabaseAdmin
		.from('metrics')
		.select('*')
		.eq('user_id', PRIVATE_SINGLE_USER_ID)
		.order('recorded_date', { ascending: false });

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

	return {
		user: null,
		metrics: metrics ?? [],
		metricTypes: metricTypes ?? [],
		sharedLinks: sharedLinks ?? []
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
