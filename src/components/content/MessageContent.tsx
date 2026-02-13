import { Fragment, useMemo } from 'react';
import { parseContent, shortenUrl } from '@/lib/content/parse';
import { InlineImage, InlineVideo, YouTubeThumbnail } from './InlineMedia';
import { NostrMention } from './NostrMention';

export function MessageContent({ content, isMine }: { content: string; isMine: boolean }) {
  const segments = useMemo(() => parseContent(content), [content]);

  const linkClass = isMine
    ? 'text-gray-950/80 underline decoration-gray-950/40 hover:decoration-gray-950/70'
    : 'text-amber-400 underline decoration-amber-400/40 hover:decoration-amber-400/70';

  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'text':
            return <Fragment key={i}>{seg.value}</Fragment>;
          case 'url':
            return (
              <a key={i} href={seg.value} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {shortenUrl(seg.value)}
              </a>
            );
          case 'image':
            return <InlineImage key={i} url={seg.value} isMine={isMine} />;
          case 'video':
            return <InlineVideo key={i} url={seg.value} />;
          case 'youtube':
            return <YouTubeThumbnail key={i} videoId={seg.videoId} url={seg.value} />;
          case 'nostr-profile':
            return <NostrMention key={i} pubkey={seg.pubkey} isMine={isMine} />;
          case 'nostr-event':
          case 'nostr-address':
            return (
              <a key={i} href={`https://njump.me/${seg.bech32}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {seg.bech32.slice(0, 16)}...
              </a>
            );
        }
      })}
    </span>
  );
}
