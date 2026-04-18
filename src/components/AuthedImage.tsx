import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

// Fetches same-origin URLs (e.g. `/file/*`) with the Bearer token that
// our axios client uses, then hands a blob ObjectURL to `<img>`. Plain
// `<img src>` can't authenticate because the browser never attaches our
// Authorization header — that's why PRIVATE memo images 401 otherwise.
//
// Passthrough cases (no fetch): data:, blob:, http(s):, and empty src.

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
}

function needsAuth(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('data:') || src.startsWith('blob:')) return false;
  if (/^https?:\/\//i.test(src)) return false;
  return true;
}

export default function AuthedImage({ src, ...rest }: Props) {
  const [resolved, setResolved] = useState<string | null>(() => (needsAuth(src) ? null : src));
  const [failed, setFailed] = useState(false);
  const currentBlob = useRef<string | null>(null);

  useEffect(() => {
    // Passthrough paths — just mirror src verbatim.
    if (!needsAuth(src)) {
      setResolved(src);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setResolved(null);
    setFailed(false);

    const token = localStorage.getItem('access_token');
    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        // Revoke the previous blob URL before swapping it in, so refs
        // don't leak across src changes.
        if (currentBlob.current) URL.revokeObjectURL(currentBlob.current);
        currentBlob.current = url;
        setResolved(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    return () => {
      if (currentBlob.current) {
        URL.revokeObjectURL(currentBlob.current);
        currentBlob.current = null;
      }
    };
  }, []);

  if (failed) {
    // Keep layout stable with the requested className; just render an
    // empty img with the broken src so error UI (if any) still fires.
    return <img {...rest} src={src} />;
  }
  if (!resolved) {
    return <img {...rest} src="" />;
  }
  return <img {...rest} src={resolved} />;
}
