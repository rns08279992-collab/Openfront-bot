# OpenFront AI implementation plan

## Objective
Build a fast, accurate, maintainable OpenFront AI around the runtime/control seam, not UI hacks.

## Architectural direction
Use:
- pinned upstream code
- generated mechanics
- legal protocol/intents
- browser-side page adapter
- strategy interpreter
- conservative baseline policy
- localhost/private eval harness

Do not use:
- DOM click bots
- fixed coordinates
- screenshot automation
- stale handwritten mechanics as runtime truth

## Current repo state
Already built:
- research/source indexing and architecture notes
- mechanics extraction/generation
- protocol/intents/actions
- ObservationAdapter
- IntentAdapter
- RuntimeHooks
- bootstrap
- DebugHUD
- eval flow
- baseline policy
- strategy-state interpreter
- local typecheck setup
- localhost speed control

## What currently works
- pinned upstream OpenFront code is the source of truth
- mechanics are generated from pinned code
- legal intents/protocol are modeled
- live runtime loop exists
- bot can spawn
- bot can expand/attack in simple cases
- debug HUD exists
- interpreter exists
- localhost eval flow exists

## What is still broken / immature
- authoritative gameplay correctness is not fully trusted yet
- territory/capture/takeover behavior needs debugging at low speed
- eval flow is still fragile and needs trustworthy result validity
- baseline is still a conservative immature bot, not an advanced AI
- build/economy is minimal
- defense/threat handling is still shallow
- larger accelerated simulations are not yet trustworthy enough to use as the main optimization loop

## Immediate priorities
1. Fix authoritative gameplay correctness bugs first.
2. Make one full localhost match trustworthy from start to finish.
3. Stabilize the minimal full-loop baseline:
   - spawn
   - opening expansion
   - hold/defend
   - safe economy spend
   - conservative attack/alliance behavior
4. Make eval results trustworthy and repeatable.
5. Only then run larger batches and optimize strategy from data.

## Workstreams
### Workstream A - gameplay correctness
Own:
- capture/takeover bugs
- renderer/state mismatches
- authoritative local gameplay correctness
Do not own:
- strategy tuning
- eval UI polish unless needed for debugging

### Workstream B - baseline/policy
Own:
- baseline.ts
- conservative behavior improvements
- phase logic
- attack/defend/build pacing
- using interpreter outputs
Do not own:
- raw observation internals unless blocked

### Workstream C - eval harness
Own:
- localhost eval flow
- result validity
- batch running
- summaries
- stable smoke tests and batch tests
Do not own:
- gameplay strategy except when needed to prevent junk evals

### Workstream D - interpreter/data model
Own:
- strategy-state interpreter
- derived signals
- observation shape cleanup
- better strategy-ready signals
Do not own:
- large policy rewrites unless explicitly requested

## Success criteria for current stage
The current stage is complete when:
- one local/private match can run start to finish without core gameplay corruption
- bot can spawn, expand, hold, attack, and do one safe economy/build action
- bot does not obviously spam or instantly self-destruct
- eval records valid outcomes or clearly marks invalid/aborted runs
- repeated small batches can run locally and produce sane JSON results

## What not to prioritize yet
- public-service hardening
- bypassing public protections
- advanced nukes
- replay harvester
- remote policy server
- big ML/self-play systems
- broad UI polish

## Self-checking policy
Every task must:
- run the smallest correct verification
- inspect results
- fix obvious local issues
- report exactly what changed and how it was verified

## Codex operating rule
Ask only when blocked by a real ambiguity.
Otherwise continue independently within the assigned workstream.
