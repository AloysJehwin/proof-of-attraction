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

export function resetRealtimeClient(): void {
  try {
    sharedClient?.close();
  } catch {}
  sharedClient = null;
}

const POLL_MS = 4000;
// Ably: "Channel denied access based on given capability".
const CAPABILITY_DENIED = 40160;

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

    const startPolling = () => {
      if (poll || !active) return;
      setLive(false);
      poll = setInterval(async () => {
        const fresh = await getMessages(matchId).catch(() => []);
        if (active) merge(fresh);
      }, POLL_MS);
    };

    (async () => {
      const history = await getMessages(matchId).catch(() => []);
      if (!active) return;
      merge(history);
      setLoaded(true);

      const client = await getClient();
      if (!active) return;
      if (!client) {
        startPolling();
        return;
      }

      channel = client.channels.get(`chat:${matchId}`);
      channel.subscribe('message', (msg) => merge([msg.data as ApiMessage])).catch(() => undefined);

      // The token's capability is a snapshot of the user's matches at mint time,
      // so a match created after that is denied until we re-authorize. Refresh the
      // token once, then fall back to polling so chat always works.
      let retried = false;
      channel.on('failed', async (stateChange) => {
        const code = stateChange.reason?.code;
        if (!retried && code === CAPABILITY_DENIED && active) {
          retried = true;
          try {
            await client.auth.authorize();
            await channel?.attach();
            if (active) setLive(true);
            return;
          } catch {
            /* fall through to polling */
          }
        }
        startPolling();
      });

      channel.on('attached', () => {
        if (!active) return;
        setLive(true);
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
      });

      channel.attach().catch(() => startPolling());
    })();

    return () => {
      active = false;
      if (channel) {
        channel.off();
        channel.unsubscribe();
      }
      if (poll) clearInterval(poll);
    };
  }, [matchId, merge]);

  const appendLocal = useCallback((m: ApiMessage) => merge([m]), [merge]);

  return { messages, live, loaded, appendLocal };
}

