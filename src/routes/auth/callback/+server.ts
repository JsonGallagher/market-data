import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const nextParam = url.searchParams.get('next') ?? '/dashboard';
	const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			redirect(303, next);
		}
	}

	redirect(303, '/auth/login?error=auth-code-error');
};
