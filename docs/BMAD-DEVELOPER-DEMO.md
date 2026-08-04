# BMAD Developer Demo Artifact

## Context
This repository currently has one BMAD skill installed: `bmad-code-review`.
A dedicated `bmad developer` skill/workflow was not found in the workspace.

## Developer Story
- Story ID: BMAD-DEV-001
- Title: Add delivery preflight checks before final send
- Actor: Consultant
- Goal: Validate readiness in one place before submit
- Benefit: Avoid repeated 409 failures in the send flow

## Acceptance Criteria
1. Delivery screen shows a single readiness badge (`ready` or `blocked`).
2. Send action is disabled with explicit reason when blocked.
3. API returns a structured error code and hint for each blocked state.
4. UI shows translated messages per error code.

## Technical Tasks
1. Create GET `/api/diagnostics/send-preflight?caseId=...`
2. Return JSON:
   - `caseStatus`
   - `reviewStatus`
   - `canSend`
   - `reasonCode`
3. Call preflight on Delivery page load and before send click.
4. Block send button when `canSend=false`.
5. Add unit tests for preflight and UI states.

## Definition of Done
1. Consultant cannot click send when preflight fails.
2. No generic 409 message shown without context.
3. Tests cover all blocked reasons.
4. Lint and typecheck pass.

## Suggested Next BMAD Step
- Convert this story into an implementation task and execute in a branch.
