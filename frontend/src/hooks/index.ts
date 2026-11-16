import { useCallback, useEffect, useState } from "react";
import { detectionApi, parseApiError } from "../services/api";
import { useI18n } from "../i18n";

/** Loads a protected image (needs the JWT header) and returns an object URL. */
export function useAuthImage(url: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    detectionApi
      .imageBlob(url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return { src, failed };
}

/** Generic async loader with loading / error / reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => !cancelled && setData(d))
      .catch(async (e) => {
        if (cancelled) return;
        const info = await parseApiError(e);
        setError(t(`errors.${info.code}`) !== `errors.${info.code}` ? t(`errors.${info.code}`) : info.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, setData, loading, error, reload };
}

/** Translate an API error into the current language. */
export function useErrorText() {
  const { t, has } = useI18n();
  return useCallback(
    async (err: unknown) => {
      const info = await parseApiError(err);
      if (has(`errors.${info.code}`)) return t(`errors.${info.code}`);
      return info.fields?.[0]?.message ?? info.message ?? t("common.error");
    },
    [t, has],
  );
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
