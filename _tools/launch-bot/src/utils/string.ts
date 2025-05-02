// normalize: Lowercases, strips punctuation, collapses spaces, trims.
export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();