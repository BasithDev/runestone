import { useCallback, useEffect, useState } from 'react';
import { OttEvent, OttTitleState, getEvents, getLastFullRefresh, getTitleStates, subscribeOtt } from '../../services/ottStore';

/** Live view of the OTT events feed and tracked-title states. */
export function useOttData() {
  const [events, setEvents] = useState<OttEvent[]>([]);
  const [titles, setTitles] = useState<OttTitleState[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [e, t, r] = await Promise.all([getEvents(), getTitleStates(), getLastFullRefresh()]);
    setEvents(e);
    setTitles(t);
    setLastRefresh(r);
  }, []);

  useEffect(() => {
    reload();
    return subscribeOtt(() => { reload(); });
  }, [reload]);

  return { events, titles, lastRefresh, unread: events.filter(e => !e.read).length };
}
