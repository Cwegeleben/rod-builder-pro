# Pricing auth (Batson wholesale)

To consistently capture wholesale pricing from batsonenterprises.com during importer runs, provide an authenticated Cookie header.

Supported env vars (first non-empty wins):

- `BATSON_AUTH_COOKIE`
- `BATSON_COOKIE`

Where it's used:

- Simple RX6/RX7 series parsing: static fetch adds `Cookie`, headless fallback sets `extraHTTPHeaders.Cookie`.
- Detail-page staging and the Playwright crawler: `Cookie` is injected on same-domain requests.

How to obtain the cookie header:

1. Log into Batson in a regular browser.
2. Copy the full Cookie header value for batsonenterprises.com (one semicolon-separated string, e.g. `ASP.NET_SessionId=...; .ASPXAUTH=...`).
3. Export it before running local tasks:

   export BATSON_AUTH_COOKIE='ASP.NET_SessionId=...; .ASPXAUTH=...'

Verification:

- After a series run, check logs for `simple:price-check` entries. `wholesalePresent` should be > 0 and typically < `msrpPresent`. `suspicious` flags rows with missing wholesale or wholesale >= MSRP.

Notes:

- Cookie will be attached only to batsonenterprises.com requests.
- If the cookie expires, wholesale fields may drop to null; refresh the value.
