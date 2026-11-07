---
inclusion: always
---

# Planchette: Product Overview

## What is Planchette?

Planchette is a talking board in the browser for people who suddenly can't speak—such as someone on a ventilator, recovering from surgery, or just after a stroke. A family member opens a link at the bedside. The patient answers a moving planchette with one signal: a long blink, a nod, or a knock on an Arduino sensor.

The object is literally called a talking board, and here it helps someone who can't speak to talk.

## Users

- **Primary user:** a patient with sudden speech loss who is weak, tired, possibly frightened, and untrained.
- **Secondary user:** a family member or carer who sets it up and reads or hears the messages.

## Core Flow

1. **Setup** (target: under 1 minute). The family member opens the link in Chrome or Edge and allows the camera. The board finds a signal the patient can do reliably, sets the sweep speed, and explains that spelled text goes to an AI service while video stays on the laptop.

2. **Rest**. The sweep stays still until a wake signal arrives, so the board doesn't speak or select while the patient sleeps.

3. **Needs ring**. The planchette sweeps nine choices: Pain, Breathing, Thirsty, Toilet, Hot or cold, Call someone, Yes, No, Spell. One select picks the highlighted option. Pain, Thirsty, Hot or cold, and Call someone have follow-ups that build a complete message. Breathing, Toilet, Yes, and No are complete. Spell opens the alphabet layer.

4. **Spelling**. Opens two classic letter arcs: A to M above, N to Z below. The sweep offers suggestions first, then six letter groups, then Speak, Delete, Space and Needs. Selecting a group sweeps its letters one at a time.

5. **Speak**. The message is held for one sweep step, shown in large text, readable from across the room. A second select cancels it. It is then spoken aloud and stays on screen. The patient or board can ring the bell.

## Reference Design

See #[[file:docs/superpowers/specs/2026-11-07-planchette-design.md]] for full architecture, privacy and safety, testing, and timeline.

## Out of Scope (This Version)

- Head-steering mode.
- The patient's own voice.
- Listening to the room for context.
- Self-moving physical planchette.
- Hindi and other languages.
- Long-term AAC users (later versions after ALS community feedback).
