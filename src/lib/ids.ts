/** Showdown-style ID: lowercase alphanumerics only ("Charizardite Y" -> "charizarditey"). */
export function toID(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
