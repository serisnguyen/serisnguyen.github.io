const GIFT_FONTS = {
  sans: { label: "Be Vietnam Pro", stack: '"Be Vietnam Pro", system-ui, sans-serif' },
  storybook: { label: "Cormorant Garamond", stack: '"Cormorant Garamond", Georgia, serif' },
  serif: { label: "Playfair Display", stack: '"Playfair Display", Georgia, serif' },
  hand: { label: "Dancing Script", stack: '"Dancing Script", "Segoe Print", cursive' },
  rounded: { label: "Mali", stack: 'Mali, "Segoe Print", system-ui, sans-serif' },
};
const LETTER_SIZES = [17, 18, 20, 22, 24, 26];

function applyGiftFonts(settings, root) {
  for (const [property, key, fallback] of [
    ["--serif", "heading", "sans"],
    ["--body", "body", "sans"],
    ["--letter-font", "letter", "sans"],
  ]) {
    root.style.setProperty(property, (GIFT_FONTS[settings[key]] || GIFT_FONTS[fallback]).stack);
  }
  const size = Number(settings.letterSize);
  root.style.setProperty("--letter-size", (LETTER_SIZES.includes(size) ? size : 20) + "px");
}
