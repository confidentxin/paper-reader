import type { Analysis, ContentBlock } from '../desktop';
import { flowBlocks } from './presentation';

// Both panes use the same IDs, including pages which have not been translated yet.
export function readingBlocks(analysis: Analysis | null): ContentBlock[] {
  if (!analysis?.parse) return [];
  const completed = new Set(analysis.reading?.pages.map(p => p.page));
  return analysis.parse.pages.flatMap(p => completed.has(p.page)
    ? analysis.reading!.blocks.filter(b => b.page === p.page)
    : flowBlocks(p)).map(b=>{
      const old=analysis.translations.filter(t=>t.block_id===b.id&&t.source_hash===b.source_hash).at(-1);
      return !b.translation&&old&&b.display!=='visual'?{...b,translation:old.text}:b;
    });
}
