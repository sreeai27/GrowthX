# Hunar OS production readiness handoff

Last updated: 2026-09-03

This is the restart point for the next session. It lists the accounts, keys,
settings, commands, blockers, and checks needed to deploy the current build.
No secret value belongs in this file, Git, screenshots, or chat.

## Current state

- Ticket 9, real push-to-talk voice capture through Sarvam Saaras v3, is complete
  at Git commit `0822243`.
- The verified local checkpoint passed lint, type checking, build, 243 automated
  tests, 14 evaluation assertions, and 22 browser tests.
- Production has **not** been created or deployed yet.
- The repository is not linked to a Vercel project or Git remote.
- A Convex production deployment and production deploy key are not configured.
- Ticket 10, OpenAI request interpretation, has not started. Keep its feature flag
  off until that ticket and its tests pass.
- Private result delivery by email or SMS is not production-ready. The current
  code intentionally refuses the demonstration delivery provider in production.

## Accounts and access needed

Prepare access to all four services before starting the deployment session:

1. **Vercel** — permission to create or link the web project and manage production
   environment variables.
2. **Convex** — permission to create or select the production deployment and
   generate a production deploy key.
3. **Sarvam AI** — an account with speech-to-text credits and permission to create
   an API key in the Sarvam dashboard.
4. **OpenAI API Platform** — a project with billing/usage limits and permission to
   create a project API key. A ChatGPT subscription does not itself supply API
   credit.

Also decide who owns each account and who can rotate a leaked key.

## Keys and environment variables

Create separate production values. Add server secrets only to Vercel's
**Production** environment; never give them a `NEXT_PUBLIC_` prefix.

| Name                               | Required now?             | Where it comes from                              | Production value or rule                                                                    |
| ---------------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `CONVEX_DEPLOY_KEY`                | Yes                       | Convex dashboard, production deployment settings | Production deploy key with deployment permission. Use only during the Vercel build.         |
| `NEXT_PUBLIC_CONVEX_URL`           | Yes                       | Convex production deployment                     | Public production Convex URL. The Convex deploy command can inject it during the build.     |
| `SARVAM_API_KEY`                   | Yes for live voice        | Sarvam dashboard, API Keys                       | New production key. Server-only. Save it when created because Sarvam only displays it once. |
| `OPENAI_API_KEY`                   | Prepare now; enable later | OpenAI API project                               | Project-scoped production key. Server-only. Do not use an organisation admin key.           |
| `DEMO_SESSION_COOKIE_SECRET`       | Yes                       | Generate locally                                 | Stable random secret with at least 32 characters. Changing it signs everyone out.           |
| `DEMO_CONTACT_ENCRYPTION_KEY`      | Yes                       | Generate locally                                 | Stable high-entropy production secret. Do not rotate without a data migration plan.         |
| `FEATURE_VOICE_CAPTURE`            | Yes                       | App setting                                      | `true` after Sarvam is configured.                                                          |
| `FEATURE_OPENAI_MAPPING`           | Yes                       | App setting                                      | `false` until Ticket 10 is complete and verified.                                           |
| `FEATURE_FIXTURE_MODE`             | Yes                       | App setting                                      | `false` in production. Fixtures are test data, not live provider calls.                     |
| `PRIVATE_RESULT_DELIVERY_PROVIDER` | Blocked                   | Future approved email/SMS adapter                | Do not set to `DEMONSTRATION` in production. The current production code rejects it.        |
| `DEMO_FIXTURE_STORE_PATH`          | No                        | Local test setting                               | Do not set in production; production runs must use Convex.                                  |

Generate the two app secrets locally and paste them directly into Vercel. One
acceptable command for each secret is:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Run it twice so the cookie secret and encryption key are different. Do not save
the command output in the repository or terminal notes.

## Getting the provider keys

### Sarvam AI

1. Sign in to the [Sarvam dashboard](https://dashboard.sarvam.ai/).
2. Open **API Keys** and create a production key.
3. Copy it immediately into the password manager and Vercel as
   `SARVAM_API_KEY`.
4. Confirm the account has enough credit for Saaras v3 speech-to-text.

The current adapter sends short recordings to
`https://api.sarvam.ai/speech-to-text`, uses model `saaras:v3`, mode
`transcribe`, and authenticates with the `api-subscription-key` header. Sarvam's
[authentication documentation](https://docs.sarvam.ai/api-reference/authentication)
confirms this header and recommends keeping the key in a server environment
variable.

### OpenAI

1. Sign in to the [OpenAI API Platform](https://platform.openai.com/).
2. Create or select a dedicated Hunar OS production project.
3. Configure project billing and a conservative usage limit/alert.
4. Create a project API key, then store it in the password manager and Vercel as
   `OPENAI_API_KEY`.
5. Keep `FEATURE_OPENAI_MAPPING=false` until Ticket 10 is built and tested.

The app must read the key only on the server. Official
[OpenAI documentation](https://developers.openai.com/api/docs/guides/latest-model)
shows `OPENAI_API_KEY` as an environment variable and Bearer authentication for
the Responses API. The project specification requires the Responses API, not the
older Assistants API.

## Vercel and Convex setup order

1. Start from a clean Git checkpoint and confirm commit `0822243` is present.
2. Create or select the Convex project and its **production** deployment.
3. In Convex deployment settings, generate a production deploy key.
4. Create or link the Vercel project to this repository.
5. Add every variable in the table above to Vercel's Production environment.
6. Set the Vercel build command to:

   ```bash
   pnpm exec convex deploy --cmd "pnpm build" --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
   ```

7. Deploy a preview first and inspect its build logs.
8. Deploy to production only after the preview checks pass.
9. Point `NEXT_PUBLIC_CONVEX_URL` at the production deployment, then seed the
   fictional Sahaay demonstration data:

   ```powershell
   $env:NEXT_PUBLIC_CONVEX_URL="https://YOUR-PRODUCTION-DEPLOYMENT.convex.cloud"
   pnpm seed
   ```

10. Record the Vercel project, Convex production deployment, live URL, commit,
    and deployment time in this document after deployment.

Do not use a development Convex URL for the production site. Convex's
[Vercel deployment guide](https://docs.convex.dev/production/hosting/vercel)
documents the production deploy key and build-command flow. Vercel's
[CLI deployment guide](https://vercel.com/docs/projects/deploy-from-cli)
documents linking, preview deployment, production deployment, and verification.

## Checks before production deployment

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:evals
pnpm build
pnpm test:e2e
```

Then check the preview at 360px width and on desktop:

- sign in and reopen the same run after refresh;
- confirm recording never begins automatically;
- confirm the moving-worker safety block still prevents interaction;
- grant microphone access, record a 5–15 second Hindi, Marathi, or code-mixed
  request, and verify the native-script transcript appears;
- deny microphone access and confirm typed fallback remains usable;
- use **Record again** and confirm the earlier clip is discarded;
- simulate an unusable clip/provider failure and confirm the app abstains rather
  than inventing a transcript;
- confirm no API key appears in browser source, network responses, logs, or error
  messages;
- confirm fixtures are off and the trace stores the provider/model metadata;
- verify tenant isolation with two distinct tenant sessions;
- verify production data survives refresh and a new browser session.

## Blockers before calling the whole product production-ready

1. **Private delivery:** implement and approve a real email/SMS provider behind
   `PrivateResultDeliveryProvider`, validate its receipt, and add failure and
   idempotency tests. Until then, the private-result send step fails closed in
   production by design.
2. **Ticket 10:** implement OpenAI request mapping, validate every model output,
   store model/prompt/flow versions, add abstention/evaluation cases, and only then
   set `FEATURE_OPENAI_MAPPING=true`.
3. **Account decisions:** choose the owning Vercel and Convex projects, production
   domain, provider budgets, access list, and incident owner.
4. **Live verification:** test Sarvam with real target-device audio and confirm
   latency, accuracy, credit consumption, retention, and deletion behaviour.

## Deployment record (fill in next session)

- Vercel project: _not set_
- Convex project/deployment: _not set_
- Production URL: _not set_
- Deployed Git commit: _not deployed_
- Deployed at (UTC): _not deployed_
- Deployed by: _not deployed_
- Sarvam live check: _not run_
- OpenAI live check: _not run; Ticket 10 pending_
- Private delivery live check: _blocked; provider pending_
