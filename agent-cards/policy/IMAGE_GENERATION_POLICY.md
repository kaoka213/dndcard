# Image Generation Policy

## Purpose
This policy defines how to generate consistent agent portrait images for the card renderer. The goal is a reusable automation standard, not a one-off image.

## Inputs to Use
- System prompt: role, mission, primary responsibilities, constraints, and safety rules.
- Agent metadata: `id`, `name`, `category`, `description`, `capabilities`, `tools`, `accentColor`, `gradientEnd`, `sigLabel`.

## Inputs to Ignore
- Any UI text, headings, or copy that should appear on the card.
- Brand logos, copyrighted characters, or trademarked visual elements.
- Detailed tool names as text inside the image.

## Visual Focus Rules
- Single hero subject, portrait orientation, centered composition.
- Subject should visually encode the agent role (eg design = creative, dev = technical, qa = analytical, utility = helper).
- Use `accentColor` as the primary rim light or glow. Use `gradientEnd` for the background tone.
- Add at most 1-2 role-specific props or motifs derived from `capabilities`.
- If `tools` suggest a motif, use abstract shapes (no letters or tool names).

## Composition and Safe Areas
- Output size: 612x792, portrait.
- Keep key subject features in the central 70% of the canvas.
- Avoid the top-left and bottom corners where overlay counters appear.
- Leave the lower portion clean for text overlays.
- No embedded text, no UI panels, no watermarks.

## Prompt Template (Automation)
- Subject: a single archetype aligned with `category` and `description`.
- Action: a simple, iconic gesture related to the main responsibility.
- Environment: minimal, dark, abstract, no recognizable brands.
- Lighting: cinematic, high contrast, accent rim light in `accentColor`.
- Palette: dark base + `accentColor` highlights + `gradientEnd` shadows.
- Restrictions: no text, no logos, no copyrighted content.

## Automation Steps
1) Parse the system prompt and extract role, mission, and constraints.
2) Map role and `category` to a clear visual archetype.
3) Pick 1-2 motifs from `capabilities` and convert them into abstract props.
4) Apply color rules from `accentColor` and `gradientEnd`.
5) Generate a prompt using the template, then validate against restrictions.
