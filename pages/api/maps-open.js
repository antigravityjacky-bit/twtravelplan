/**
 * GET /api/maps-open?q=<search+query>
 *
 * Server-side redirect to Google Maps web search.
 * Routing through our own domain prevents iOS from intercepting the
 * google.com/maps URL as a Universal Link and opening the Google Maps app.
 * The user lands in Safari with the full URL in the address bar.
 */
export default function handler(req, res) {
  const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  if (!q) return res.status(400).end();

  const dest =
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  // No-cache so iOS always follows the redirect fresh
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.redirect(302, dest);
}
