import { useCallback, useEffect, useState } from 'react';
import { OttEvent, OttTitleState, getEvents, getTitleStates, subscribeOtt } from '../../services/ottStore';

/** Live view of the OTT events feed and tracked-title states. */
export function useOttData() {
  const [events, setEvents] = useState<OttEvent[]>([]);
  const [titles, setTitles] = useState<OttTitleState[]>([]);

  const reload = useCallback(async () => {
    const [e, t] = await Promise.all([getEvents(), getTitleStates()]);
    setEvents(e);
    setTitles(t);
  }, []);

  useEffect(() => {
    reload();
    return subscribeOtt(() => { reload(); });
  }, [reload]);

  return { events, titles, unread: events.filter(e => !e.read).length };
}
