import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

const AUTH_COOKIE_NAME = 'dashboard_auth';

export function requireAuth(event: RequestEvent) {
	const authCookie = event.cookies.get(AUTH_COOKIE_NAME);

	if (authCookie !== 'authenticated') {
		redirect(303, '/auth/login');
	}
}

export function setAuthCookie(event: RequestEvent) {
	event.cookies.set(AUTH_COOKIE_NAME, 'authenticated', {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});
}

export function clearAuthCookie(event: RequestEvent) {
	event.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
}
