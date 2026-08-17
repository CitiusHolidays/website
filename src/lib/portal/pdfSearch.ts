export interface PdfSearchTextItem {
  hasEOL?: boolean;
  str: string;
}

export interface PdfSearchTextPoint {
  itemIndex: number;
  offset: number;
}

export interface PdfSearchMatch {
  begin: PdfSearchTextPoint;
  end: PdfSearchTextPoint;
}

interface PdfSearchTextSegment {
  end: number;
  itemIndex: number;
  start: number;
}

function searchTextAndSegments(items: PdfSearchTextItem[]) {
  const segments: PdfSearchTextSegment[] = [];
  let text = "";
  for (const [itemIndex, item] of items.entries()) {
    const start = text.length;
    text += item.str;
    segments.push({ end: text.length, itemIndex, start });
    if (item.hasEOL) {
      text += "\n";
    }
  }
  return { segments, text };
}

function pointForOffset(
  segments: PdfSearchTextSegment[],
  offset: number,
  edge: "begin" | "end"
): PdfSearchTextPoint | null {
  const position = edge === "end" ? offset - 1 : offset;
  const segment = segments.find(
    (candidate) => position >= candidate.start && position < candidate.end
  );
  if (!segment) {
    return null;
  }
  return {
    itemIndex: segment.itemIndex,
    offset: offset - segment.start,
  };
}

export function findPdfSearchMatches(items: PdfSearchTextItem[], rawQuery: string) {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) {
    return [];
  }
  const { segments, text } = searchTextAndSegments(items);
  const searchableText = text.toLocaleLowerCase();
  const matches: PdfSearchMatch[] = [];
  let offset = searchableText.indexOf(query);
  while (offset >= 0) {
    const matchEnd = offset + query.length;
    const begin = pointForOffset(segments, offset, "begin");
    const end = pointForOffset(segments, matchEnd, "end");
    if (begin && end) {
      matches.push({ begin, end });
    }
    offset = searchableText.indexOf(query, matchEnd);
  }
  return matches;
}

export function stepPdfSearchMatch(current: number, total: number, direction: -1 | 1) {
  if (total < 1) {
    return -1;
  }
  return (Math.max(0, current) + direction + total) % total;
}
