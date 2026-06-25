---
name: company-brain-builder
description: Convert a company profile or website extraction into a conservative, upload-ready brain markdown for intake agents, keeping outputs fact-grounded and preserving the service signals needed to persist starter questions with the saved brain config.
metadata:
  short-description: Build conservative company brains from source profiles
---

# Company Brain Builder

Use this skill when turning a company profile, website extraction, or firm summary into an upload-ready brain markdown for the admin provisioning flow.

## Goal

Create a conservative, factual brain that is safe for intake use:
- keep claims grounded in the provided source
- infer only lightly from public signals
- avoid hype, guarantees, and invented detail
- preserve a calm, professional intake posture
- support optional industry context when the source makes it useful
- preserve enough service context that the upload pipeline can persist starter questions with the saved brain config

## Workflow

1. Read the source profile or website extraction first.
2. Extract only public, supportable facts:
   - company name
   - industry or sector if stated or clearly implied
   - public leadership names if useful
   - service lines, practice areas, or offerings
   - contact cues and routing signals
3. Decide the intake posture:
   - default to conservative, accurate, and human
   - qualify by service fit, matter type, jurisdiction, timeline, and contact details
   - escalate whenever advice, judgment, or representation is implied
4. Write the brain as markdown with structured slots.
5. Keep the firm's public service areas and qualification cues explicit. Use `## Qualification hints` for agent guidance and `## Suggested initial questions` for the 3 user-facing starter questions stored in the compiled brain config.
6. Save the result in the same folder as the source profile using a `_brain.md` suffix.
7. If public facts are sparse, keep the brain generic and avoid filling gaps with assumptions.

## Required sections

Use these headings so the runtime compiler can map the content:
- `## Business summary`
- `## Tone`
- `## Greeting`
- `## Qualification posture`
- `## Qualification hints`
- `## Suggested initial questions`
- `## Escalation rules`
- `## Forbidden claims`
- `## Service emphasis`

## Optional sections

Add these only when the source supports them:
- `## Industry context`
- `## Leadership signals`
- `## Contact cues`
- `## Qualification hints`
- `## Terminology`

## Writing rules

- Keep the tone calm, precise, and professional.
- Prefer short bullets over long prose.
- Use business facts, not marketing language.
- Treat public names as context signals only.
- Use industry-specific wording only when the source justifies it.
- If a field is missing, omit it or keep it generic.
- Do not invent clients, outcomes, credentials, or coverage.
- Do not claim legal, financial, medical, or regulatory authority unless the source explicitly supports it.
- Keep qualification language concrete enough that service areas and visitor examples remain useful downstream.
- Write qualification hints as internal agent guidance, phrased as what the assistant should ask or confirm next.
- Write suggested initial questions as customer-facing problem questions, not internal screening prompts.
- Ground both sections in real service areas or public expertise zones from the source.
- Aim for suggested initial questions that a prospect would naturally ask when facing a problem, such as compliance, transaction risk, dispute escalation, or operational fit.

## Output shape

The brain markdown should usually include:
- a short business summary
- a tone block with preferred greeting
- a greeting block that opens the conversation gently
- a qualification posture block that steers intake
- a qualification hints block with internal guidance
- a suggested initial questions block with 3 customer-facing problem questions
- escalation rules that route risk to humans
- forbidden claims that prevent hallucination
- service emphasis that mirrors the public website
- optional industry and leadership context
- clear service signals that can be persisted into starter questions during upload

## Conservative intake pattern

When the company is a professional services firm or another high-stakes business:
- qualify the visitor before advice
- ask what they need, who they are, the matter type, and the timeline
- route sensitive, legal, regulated, or commitment-heavy requests to a human
- avoid implying certainty or representation

## File naming

Use the source filename as the base and replace the suffix with `_brain.md`.
Example:
- source: `company_profile.md`
- output: `company_brain.md`
