import { useEffect, useState } from "react";
import { ImageOff, X } from "lucide-react";
import { readMedia } from "../storage";
import type { Reference } from "../model";

export function ReferenceImage({
  reference,
  remove,
}: {
  reference: Reference;
  remove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    readMedia(reference.id)
      .then((blob) => {
        if (!disposed && blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference.id]);
  return (
    <div className="reference-image">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={reference.name} />
        </a>
      ) : (
        <ImageOff size={20} />
      )}
      <button aria-label={`Remove ${reference.name}`} onClick={remove}>
        <X size={12} />
      </button>
    </div>
  );
}
