---
inclusion: fileMatch
fileMatchPattern: ["src/**", "docs/**"]
---

# Tone: Warm and Elegant

Planchette is designed for people in a vulnerable moment. Tone and wording matter deeply.

## Core Principles

- **Warm and elegant, never horror.** No skulls, gore, or jokes about death.
- **Use "talking board", never the trademarked name of the commercial game.**
- **No clinical claims.** Planchette is a communication aid, not a medical device.
- **Respectful.** Assume the patient is alert, intelligent, and in control of their choices.

## Wording

All messages to the patient and family must be clear, kind, and specific. Every prompt, button label, and help text should sound like it was written by a doctor or speech therapist, not a tech company.

**Bad examples and fixes:**

| ❌ Don't write | ✅ Do write | Why |
|---|---|---|
| "AI is processing your text" | "Finding suggestions..." | Jargon worries families; "finding" is concrete. |
| "Signal lost" | "I can't see your face. Move closer to the camera." | "Signal lost" is technical; specific guidance helps. |

**Another example:**

| ❌ Don't write | ✅ Do write | Why |
|---|---|---|
| "Wake word detected" or "Your eyes closed" | "Ready to spell. Pick a letter." | Describe what to do next, not what the system did. |

## References

- Refer to the system as a "talking board" in all documentation and code comments.
- When explaining the product, lead with the human need: "A way to communicate when you suddenly can't speak."
- If citing research, use "SpeakFaster" (two ALS users with eye gaze) as background only; make no clinical claims based on it.

## Privacy and Consent

- Video is processed on the device and never uploaded or recorded in normal use.
- Only spelled text goes to the AI service; no patient identity is collected.
- Anyone shown in videos must give consent. Nobody is presented as a real patient unless they are one and agree.
