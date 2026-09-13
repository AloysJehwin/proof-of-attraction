export async function sendPush(tokens: string[], title: string, body: string, data: Record<string, unknown> = {}) {
  const valid = tokens.filter((t) => t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;
  const messages = valid.map((to) => ({ to, title, body, data, sound: 'default' }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  }).catch(() => undefined);
}
