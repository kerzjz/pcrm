// @para-doc [#csa-sec-logout-form]
import type { APIRoute } from 'astro';

// @para-doc [#csa-sec-logout-form]
export const POST: APIRoute = async (context) => {
  context.cookies.delete('session', {
    path: '/',
  });

  const response = context.redirect('/login', 302);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return response;
};
