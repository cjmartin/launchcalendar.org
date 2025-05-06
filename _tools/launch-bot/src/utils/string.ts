// normalize: Lowercases, strips punctuation, collapses spaces, trims.
export const normalize = (s: string, stripWords?: string[]): string => {
  let result = s.toLowerCase();
  if (stripWords && stripWords.length > 0) {
    for (const word of stripWords) {
      // Remove as whole word, dashes, or underscores
      result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
      result = result.replace(new RegExp(`[-_]?${word}[-_]?`, 'gi'), '');
    }
  }
  result = result
    .replace(/[^a-z0-9 ]+/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
  return result;
};