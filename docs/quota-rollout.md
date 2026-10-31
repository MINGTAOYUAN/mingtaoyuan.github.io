# Durable quota rollout — 2026-10-31

Upstash Redis `mingtao-ai-quota` was created using the **Free** plan (500,000 monthly commands), primary region `iad1`, no read replicas, eviction disabled. It was connected only to `mingtao-ai-backend` production and preview, with sensitive environment variables. No secrets were read or copied.

Vercel Marketplace provisions `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The quota adapter now accepts this pair when neither explicit `UPSTASH_REDIS_REST_*` setting is present. Partial explicit settings fail closed; credential families are never mixed. The read-only token cannot reserve quota.

OpenAI organization billing was verified with auto-reload **OFF** and an enforced **$8 monthly organization-wide spend limit**. The interface warns that enforcement can be delayed and usage may slightly exceed the limit. This is a ceiling, not a monthly credit grant.

Configured request limits remain 300 cumulative, 100/day globally, 10/day/IP and 2/minute/IP. Production and preview use separate namespaces and salts. The cumulative counter must not be reset automatically or by a namespace change. Failed provider requests also consume a reservation.

`LAB_PUBLIC_AI` remains false. Before activation: merge the reviewed compatibility PR, deploy a preview with public mode enabled, test actual Redis persistence and denials plus both generation endpoints, and review answer quality. Only after those checks should production be enabled and redeployed. Do not claim hosted quota or generation success from unit tests alone.
