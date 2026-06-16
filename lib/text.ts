// Plain-text excerpt of a markdown string, for previews/cards.
export function excerpt(markdown: string, max = 160): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → label
    .replace(/^[\s>#\-*+]+/gm, "") // leading list/quote/heading markers
    .replace(/[*_~`]/g, "") // emphasis / inline code markers
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

// Preferred short description: the explicit summary, else an excerpt of the body.
export function summaryOf(a: { summary?: string | null; body: string }, max = 160): string {
  const s = a.summary?.trim();
  return s ? s : excerpt(a.body, max);
}
