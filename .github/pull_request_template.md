## Summary

Describe the change and why it’s needed.

## Checklist

- [ ] Preserved Shopify query params (`embedded`, `hmac`, `host`, `id_token`, `locale`, `session`, `shop`, `timestamp`) in any redirects
- [ ] Used 303 for POST→GET redirects (actions), 302 for GET
- [ ] Redirects stay same-origin (use App Bridge Redirect for top-level if required)
- [ ] Avoided redirect loops; tested target path doesn’t bounce back
- [ ] Legacy routes are covered by thin redirect stubs instead of 404
- [ ] Updated docs if routes moved: `docs/redirects-guidelines.md`

### Admin integration

- [ ] Considered UI extensions (actions/blocks/print) vs admin links for admin integration
- [ ] Used App Bridge for navigation/modals/save bar and Polaris for UI components
- [ ] Followed admin performance best practices (optimize JS/CSS, OAuth/install)
- [ ] Verified experience in embedded iframe (web + mobile)

## Testing

- [ ] Verified redirects work inside Shopify embedded iframe
- [ ] Confirmed no 404s for legacy bookmarks or Shopify deep links
