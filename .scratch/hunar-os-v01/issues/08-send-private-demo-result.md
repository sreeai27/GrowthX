# 08: Send the private demo result

**What to build:** An engaged demo visitor may optionally provide an email address or Indian mobile number to receive a seven-day private result link and separately opt into one future account invitation without turning contact data into identity or blocking the demo.

**Blocked by:** 07: Complete and verify the agreement.

**Status:** completed

- [x] The optional contact checkpoint appears after the structured request summary and once more at the final result; skipping never limits progress.
- [x] Result copy contains only the request summary, policy outcome, customer decision and final receipt and excludes raw transcripts and internal Trace data.
- [x] Email/SMS delivery is behind an interface, persists provider receipts or redacted errors and offers safe retry while keeping the result visible.
- [x] Result links are unguessable, read-only, scoped to one run and expire after seven days.
- [x] Limits of three sends per browser per hour and five per normalised contact per day are enforced and tested.
- [x] Result contact expires after 30 days; separate unchecked invitation consent expires after six months or one invitation.
