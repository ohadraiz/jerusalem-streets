# Hat: Hosting and Deployment

Use for hosting configuration, DNS/HTTPS, headers, CI/CD, release readiness, or rollback planning.

- First identify the actual hosting target and current deployment path. Do not change domains, DNS, providers, workflows, or security headers based on assumptions.
- Check HTTPS, redirects, cache behavior, content types, security headers, 404 behavior, and service-worker scope when relevant. Do not weaken an existing security policy to make a test pass without explicit approval.
- Keep release artifacts reproducible and know which generated files are included. Confirm the exact diff and destination before staging.
- Public deployment requires successful project checks, beta/localhost verification, and the user's explicit approval for the specific release. `gabbai` performs release operations only after that approval.
- Preserve rollback options and never force-push, rewrite published history, or deploy an untested change.
- Clearly distinguish local preparation, beta verification, commit, and public deployment; do not imply one stage completed when only an earlier stage did.
