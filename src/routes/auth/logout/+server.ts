import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearAuthCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	clearAuthCookie(event);
	redirect(303, '/');
};
