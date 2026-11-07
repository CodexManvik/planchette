---
inclusion: fileMatch
fileMatchPattern: "src/ui/**"
---

# Accessibility: Readability from Bed

Planchette is used by people who are weak, tired, and possibly unable to move their heads. Every design choice prioritizes visibility and clarity.

## Text and Contrast

- **Large text for the current option.** Must be readable from a bed (2 metres away, lying down, in dim light).
- **Strong contrast.** Minimum WCAG AA (4.5:1 for text, 3:1 for UI components).
- **No small print.** All critical information uses the same base text size or larger.
- **Use large, clear lettering.** Parlour uses a serif face and Daylight uses a sans-serif face, and both must stay readable from a bed.

## Motion

- **Respect `prefers-reduced-motion`.** All animations must have a no-motion alternative.
- **No flashing.** Sweep animations must be smooth glides, never jerky or stroboscopic.
- **Gentle transitions.** When the option changes, move the planchette smoothly to the next selection.

## State and Information

- **Never use colour alone.** Every state change must also be shown with text, icons, or shape.
  - Example: don't show "ready to select" as green alone; also label it "Ready" or add an icon.
  - Example: don't show "no camera" as red alone; show text "Camera not found" and an icon.
- **Always name the current option in text.** The planchette's position is not enough; write the label.
- **Show progress clearly.** If the alphabet is sweeping through letters, write which letter is highlighted.
- **Notices for the family member.** Lost face tracking, disconnected Arduino, speech unavailable—all appear as clear notices, not icons or colour.

## Testing

- View the board from 2 metres away, in dim light, and while lying down.
- Test with reduced-motion enabled in your OS settings.
- Use a colour-contrast checker on all text and interactive elements.
- Ensure every interactive state is accompanied by text, not colour or icon alone.
