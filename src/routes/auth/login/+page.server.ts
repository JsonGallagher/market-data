import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { DASHBOARD_PASSWORD } from '$env/static/private';
import { setAuthCookie } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies }) => {
	// If already authenticated, redirect to dashboard
	if (cookies.get('dashboard_auth') === 'authenticated') {
		redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password') as string;

		if (!password) {
			return fail(400, { error: 'Password is required' });
		}

		if (password !== DASHBOARD_PASSWORD) {
			return fail(400, { error: 'Invalid password' });
		}

		setAuthCookie(event);
		redirect(303, '/dashboard');
	}
};
