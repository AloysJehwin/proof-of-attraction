import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';
import { getMessages, getRealtimeToken, ApiMessage } from '../api';

let sharedClient: Ably.Realtime | null = null;

async function getClient(): Promise<Ably.Realtime | null> {
  if (sharedClient) return sharedClient;
  const probe = await getRealtimeToken().catch(() => ({ enabled: false }));
  if (!probe.enabled) return null;
  sharedClient = new Ably.Realtime({
    authCallback: async (_params, callback) => {
      try {
        const res = await getRealtimeToken();
        callback(null, (res.token as Ably.TokenRequest) ?? null);
      } catch (e) {
        callback(e instanceof Error ? e.message : 'token error', null);
      }
    },
  });
  return sharedClient;
}

const POLL_MS = 4000;

export function useMatchChannel(matchId: string | undefined) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const merge = useCallback((incoming: ApiMessage[]) => {
    setMessages((prev) => {
      const next = [...prev];
      for (const m of incoming) {
        if (seen.current.has(m.id)) continue;
        seen.current.add(m.id);
        next.push(m);
      }
      return next.sort((a, b) => a.createdAt - b.createdAt);
    });
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let channel: Ably.RealtimeChannel | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let active = true;

    (async () => {
      const history = await getMessages(matchId).catch(() => []);
      if (!active) return;
      merge(history);
      setLoaded(true);

      const client = await getClient();
      if (!active) return;
      if (client) {
        setLive(true);
        channel = client.channels.get(`chat:${matchId}`);
        channel.subscribe('message', (msg) => merge([msg.data as ApiMessage]));
      } else {
        poll = setInterval(async () => {
          const fresh = await getMessages(matchId).catch(() => []);
          merge(fresh);
        }, POLL_MS);
      }
    })();

    return () => {
      active = false;
      if (channel) channel.unsubscribe();
      if (poll) clearInterval(poll);
    };
  }, [matchId, merge]);

  const appendLocal = useCallback((m: ApiMessage) => merge([m]), [merge]);

  return { messages, live, loaded, appendLocal };
}
