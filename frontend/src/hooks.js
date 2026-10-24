import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

export function useResource(url) {
  const [state, setState] = useState({
    data: null,
    loading: Boolean(url),
    error: null,
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });
    api(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, loading: false, error });
      });
    return () => controller.abort();
  }, [url, version]);
  return { ...state, reload };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const lock = useRef(false);
  async function run(action, success) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (success) setMessage({ type: "success", text: success });
      return result;
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, message, setMessage, run };
}
