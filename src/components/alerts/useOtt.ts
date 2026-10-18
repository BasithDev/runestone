import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OttEvent, OttTitleState, getEvents, getLastFullRefresh, getTitleStates, subscribeOtt } from '../../services/ottStore';

/** Live view of the OTT events feed and tracked-title states. */
export function useOttData() {
  const [events, setEvents] = useState<OttEvent[]>([]);
  const [titles, setTitles] = useState<OttTitleState[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const [e, t, r] = await Promise.all([getEvents(), getTitleStates(), getLastFullRefresh()]);
      if (!alive.current) return;
      setEvents(e);
      setTitles(t);
      setLastRefresh(r);
    } catch { /* keep the previous values */ }
  }, []);

  useEffect(() => {
    alive.current = true;
    reload();
    const unsub = subscribeOtt(() => { reload(); });
    return () => { alive.current = false; unsub(); };
  }, [reload]);

  const unread = useMemo(() => events.filter(e => !e.read).length, [events]);
  return { events, titles, lastRefresh, unread };
}
