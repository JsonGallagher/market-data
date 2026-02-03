import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PRIVATE_SINGLE_USER_ID } from '$env/static/private';
import type { AIInsight } from '$lib/ai/openai-insights';

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

function isValidRange(value: string | null): value is DateRange {
	return value === '6m' || value === '12m' || value === '24m' || value === '5y' || value === 'all';
}

export const load: PageServerLoad = async ({ url, locals: { supabaseAdmin } }) => {
	// Get date range from URL param, default to 12 months
	const rangeParam = url.searchParams.get('range');
	const range: DateRange = isValidRange(rangeParam) ? rangeParam : '12m';
	const cutoffDate = getCutoffDate(range);

	// Build query with optional date filter
	// Supabase has a default 1000 row limit - use .range() to fetch all data
	const PAGE_SIZE = 1000;
	let allMetrics: any[] = [];
	let totalCount = 0;
	let metricsError: any = null;

	// First, get the count
	let countQuery = supabaseAdmin
		.from('metrics')
		.select('*', { count: 'exact', head: true })
		.eq('user_id', PRIVATE_SINGLE_USER_ID);

	if (cutoffDate) {
		countQuery = countQuery.gte('recorded_date', cutoffDate.toISOString().split('T')[0]);
	}

	const { count } = await countQuery;
	totalCount = count ?? 0;

	// Fetch all data in pages
	let offset = 0;
	while (offset < totalCount) {
		let query = supabaseAdmin
			.from('metrics')
			.select('*')
			.eq('user_id', PRIVATE_SINGLE_USER_ID)
			.order('recorded_date', { ascending: false })
			.range(offset, offset + PAGE_SIZE - 1);

		if (cutoffDate) {
			query = query.gte('recorded_date', cutoffDate.toISOString().split('T')[0]);
		}

		const { data, error } = await query;

		if (error) {
			metricsError = error;
			break;
		}

		if (data) {
			allMetrics = allMetrics.concat(data);
		}

		// If we got fewer rows than PAGE_SIZE, we've reached the end
		if (!data || data.length < PAGE_SIZE) {
			break;
		}

		offset += PAGE_SIZE;
	}

	const metrics = allMetrics;

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

	// Fetch user's chart annotations
	const { data: annotations, error: annotationsError } = await supabaseAdmin
		.from('chart_annotations')
		.select('*')
		.eq('user_id', PRIVATE_SINGLE_USER_ID)
		.order('annotation_date', { ascending: false });

	if (annotationsError) {
		console.error('Failed to fetch annotations:', annotationsError);
	}

	// Fetch cached AI insights (generated on import, not live)
	let aiInsights: AIInsight[] = [];
	const { data: cachedInsights } = await supabaseAdmin
		.from('ai_insights')
		.select('insights, generated_at')
		.eq('user_id', PRIVATE_SINGLE_USER_ID)
		.single();

	if (cachedInsights?.insights) {
		aiInsights = cachedInsights.insights as AIInsight[];
	}

	return {
		user: null,
		metrics,
		metricTypes: metricTypes ?? [],
		sharedLinks: sharedLinks ?? [],
		annotations: annotations ?? [],
		range,
		lastImport: lastImport ?? null,
		aiInsights
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
	},

	saveAnnotation: async ({ request, locals: { supabaseAdmin } }) => {
		const formData = await request.formData();
		const annotationDate = formData.get('annotationDate') as string;
		const label = formData.get('label') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const color = formData.get('color') as string;

		if (!annotationDate || !label) {
			return fail(400, { error: 'Date and label are required' });
		}

		if (label.length > 50) {
			return fail(400, { error: 'Label must be 50 characters or less' });
		}

		const validCategories = ['fed_rate', 'local_event', 'market_event', 'custom'];
		if (!validCategories.includes(category)) {
			return fail(400, { error: 'Invalid category' });
		}

		const { error } = await supabaseAdmin.from('chart_annotations').insert({
			user_id: PRIVATE_SINGLE_USER_ID,
			annotation_date: annotationDate,
			label: label.trim(),
			description: description?.trim() || null,
			category,
			color: color || '#d4a853'
		});

		if (error) {
			console.error('Failed to save annotation:', error);
			return fail(500, { error: 'Failed to save annotation' });
		}

		return { success: true };
	},

	deleteAnnotation: async ({ request, locals: { supabaseAdmin } }) => {
		const formData = await request.formData();
		const annotationId = formData.get('annotationId') as string;

		if (!annotationId) {
			return fail(400, { error: 'Annotation ID is required' });
		}

		const { error } = await supabaseAdmin
			.from('chart_annotations')
			.delete()
			.eq('id', annotationId)
			.eq('user_id', PRIVATE_SINGLE_USER_ID);

		if (error) {
			console.error('Failed to delete annotation:', error);
			return fail(500, { error: 'Failed to delete annotation' });
		}

		return { success: true };
	}
};
