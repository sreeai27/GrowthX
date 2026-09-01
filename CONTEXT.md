# Hunar OS

Hunar OS resolves bounded exceptions in frontline work by turning messy reports into source-backed, authorised and verifiable outcomes.

## Language

**Scenario pack**:
A bounded exception workflow that applies the shared Hunar OS resolution infrastructure to one named frontline-work situation.
_Avoid_: Product, vertical, generic use case

**TaskConfirm**:
The primary scenario pack for resolving a customer-requested change during an active home-service booking, including policy resolution, required approval, action and verification.
_Avoid_: Scope-change chatbot, add-on assistant

**Policy outcome**:
One of five deterministic TaskConfirm results: included, add-on approval required, trade-off required, not supported or safety escalation. It comes from approved booking and policy data, never model judgement.
_Avoid_: AI decision, AI recommendation

**Ride Replay**:
The secondary scenario pack for a Hindi-speaking rider safely practising how to handle confusing Marathi or Kannada instructions after stopping or completing the ride.
_Avoid_: Live ride assistant, passenger recorder

**Replay**:
A changed practice situation created after an operational incident to test the same capability without copying the original wording.
_Avoid_: Lesson, course, certification

**Build Week scope**:
The public demonstration presents TaskConfirm and Ride Replay side by side in KaamSaathi while TaskConfirm remains the release-blocking 120-second golden path. Other scenario packs remain future work.
_Avoid_: Full scenario roadmap

**Build Week usability evidence**:
Observed completion and feedback from friends and worker-side testers using the public demo. It does not establish buyer demand or operator willingness to pay.
_Avoid_: Customer validation, market validation, commercial proof

**KaamSaathi**:
The worker-facing Hunar OS product surface for handling and practising bounded frontline-work exceptions.
_Avoid_: Generic worker chatbot, language-learning app

**Hunar Studio**:
The employer-facing product surface for managing approved knowledge, roles, simulations, incidents and operational review.
_Avoid_: Public admin panel, generic content manager

**Hunar Trace**:
The evidence surface that explains a Hunar OS decision through its source, stages, handoffs, evaluation and outcome.
_Avoid_: Chain-of-thought viewer, raw observability log

**Hunar Connect**:
The platform layer that links Hunar OS with authorised partner systems and communication channels.
_Avoid_: Standalone integration marketplace, unrestricted connector

**Hunar Graph**:
The internal relationship model connecting work, capabilities, incidents, evidence, assistance and outcomes.
_Avoid_: Public social graph, worker ranking

**Hunar Passport**:
A future worker-controlled surface for portable evidence of demonstrated capabilities.
_Avoid_: Employer scorecard, launch credential, public worker profile

**Hunar Network**:
A future opportunity-matching surface based on governed capability evidence and worker consent.
_Avoid_: Current marketplace, automatic job allocation, rating replacement

**Guided demo session**:
A no-account public session using seeded fictional worker data. Customer approval uses a separate secure link, and Hunar Trace access is read-only; administrative actions and private run data remain protected.
_Avoid_: Anonymous admin access, open demo account

**Unverified demo contact**:
An email address or Indian mobile number a visitor may provide for private-result delivery or a separately consented account invitation. It is not a unique ID, proof of identity or authority to access an earlier run.
_Avoid_: Verified identity, authenticated account, login credential, user ID

**Demo run**:
One visitor's isolated attempt at the guided demo. It can be resumed through its private session but is not a user account and cannot be recovered from an unverified demo contact.
_Avoid_: User account, shared demo session

**Abandoned demo run**:
An unfinished demo run replaced when its visitor chooses to start again and no longer available for resumption.
_Avoid_: Saved attempt, secondary active run

**Demo contact checkpoint**:
An optional moment after the structured request summary, and once again at the final result, when a visitor may ask to receive a private demo result. It never gates the demo.
_Avoid_: Sign-in screen, account gate

**Account invitation consent**:
A separate optional choice permitting one future Hunar account invitation. It is independent of private-result delivery and is not general marketing consent.
_Avoid_: Marketing consent, permanent contact list, account registration

**Private demo result**:
A read-only artifact containing the request summary, policy outcome, customer decision and final receipt for one demo run. It excludes raw transcripts and internal Hunar Trace data.
_Avoid_: Account dashboard, editable trace, permanent result URL

**Public Trace**:
A redacted, read-only explanation of the current visitor's demo run or a curated fictional example, including decision stages, supporting source/version, approvals and final receipt. It excludes raw prompts, personal data, internal errors and other visitors' runs.
_Avoid_: Internal Hunar Trace, public run directory, editable audit log

**Demo operator**:
A named team member with ordinary administrative access to the demo. Demo operators see masked contacts; public visitors and judges are never demo operators.
_Avoid_: Shared admin, public administrator, judge account

**Platform administrator**:
A named privileged team member who may reveal a visitor's full demo contact for its permitted purpose after recording a reason. This access is attributable and audited.
_Avoid_: Master admin, silent contact access, shared superuser

**Demo deletion request**:
A visitor's request for early removal of retained demo data or contact, decided through recorded administrator judgment. It may receive a second-administrator review and leaves only anonymous totals and a non-identifying completion receipt when approved.
_Avoid_: Automatic deletion claim, unaudited administrator discretion

**Curated Trace gallery**:
Three fictional Public Trace examples covering an included request, a completed customer approval and an unsupported or escalated case.
_Avoid_: Visitor trace gallery, exhaustive outcome catalogue

**Anonymous demo totals**:
Combined counts such as starts, completions and drop-offs that remain after a demo run and its contact data are deleted. They contain no contact details, free text, transcripts, traces or identifier that can reconnect a total to a visitor.
_Avoid_: Anonymised full run, contact history, retained trace
