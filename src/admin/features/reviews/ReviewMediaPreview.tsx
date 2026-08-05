type ReviewMedia = { id: string; kind: "image" | "video"; storageUrl?: string | null; fileStatus?: string | null };

type Props = { media: ReviewMedia[] };

export function ReviewMediaPreview({ media }: Props) {
  if (!media.length) return null;

  return <div className="tmr-admin-review-media" aria-label="Review media">
    {media.map((item) => {
      if (!item.storageUrl) return <span className="tmr-admin-review-media__processing" key={item.id}>Processing upload</span>;
      return item.kind === "video"
        ? <video key={item.id} className="tmr-admin-review-media__video" controls preload="metadata"><source src={item.storageUrl} type="video/mp4" /></video>
        : <a key={item.id} href={item.storageUrl} target="_blank" rel="noreferrer" aria-label="Open review image"><img className="tmr-admin-review-media__image" src={item.storageUrl} alt="Customer review upload" loading="lazy" /></a>;
    })}
  </div>;
}
