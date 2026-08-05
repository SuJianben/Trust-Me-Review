type ReviewMedia = { id: string; kind: "image" | "video" };

type Props = { media: ReviewMedia[] };

function mediaUrl(id: string) {
  return `/api/review-media/${encodeURIComponent(id)}`;
}

export function ReviewMediaPreview({ media }: Props) {
  if (!media.length) return null;

  return <div className="tmr-admin-review-media" aria-label="Review media">
    {media.map((item) => item.kind === "video"
      ? <video key={item.id} className="tmr-admin-review-media__video" controls preload="metadata"><source src={mediaUrl(item.id)} type="video/mp4" /></video>
      : <a key={item.id} href={mediaUrl(item.id)} target="_blank" rel="noreferrer" aria-label="Open review image"><img className="tmr-admin-review-media__image" src={mediaUrl(item.id)} alt="Customer review upload" loading="lazy" /></a>)}
  </div>;
}
