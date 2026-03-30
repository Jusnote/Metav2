import * as React from 'react';

import type {
  SlateElementProps,
  TCaptionElement,
  TMediaEmbedElement,
  TResizableProps,
} from 'platejs';

import { NodeApi } from 'platejs';
import { SlateElement } from 'platejs/static';

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

export function MediaEmbedElementStatic(
  props: SlateElementProps<TMediaEmbedElement & TCaptionElement & TResizableProps>
) {
  const { align = 'center', caption, url, width } = props.element;

  const youtubeId = url ? getYouTubeId(url) : null;
  const vimeoId = url ? getVimeoId(url) : null;
  const embedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}`
    : vimeoId
    ? `https://player.vimeo.com/video/${vimeoId}`
    : url;

  return (
    <SlateElement className="py-2.5" {...props}>
      <div style={{ textAlign: align }}>
        <figure
          className="group relative m-0 inline-block cursor-default"
          style={{ width: width ?? '100%' }}
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-sm">
            <iframe
              className="absolute inset-0 size-full border-0"
              src={embedUrl}
              title="Embedded media"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          {caption && <figcaption>{NodeApi.string(caption[0])}</figcaption>}
        </figure>
      </div>
      {props.children}
    </SlateElement>
  );
}
