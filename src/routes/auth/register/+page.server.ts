import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const fullName = formData.get('fullName') as string;

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required' });
		}

		if (password.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters' });
		}

		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`,
				data: {
					full_name: fullName || ''
				}
			}
		});

		if (error) {
			return fail(400, { error: error.message });
		}

		return {
			success: 'Check your email to confirm your account'
		};
	}
};
