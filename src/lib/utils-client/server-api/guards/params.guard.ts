import { type RequestEvent, json } from '@sveltejs/kit';

export const parseParams = (event: RequestEvent, params: string[], regex: RegExp) => {
  const searchParams = event.url.pathname.match(regex)?.slice(1);

  const res: Record<string, string | null> = {};
  let i = 0;

  for (const param of params) {
    res[param] = searchParams?.[i] ?? null;
    i++;
  }

  return res;
};

export const paramsGuard = async (
  event: RequestEvent,
  rawParams: string[],
  regex: RegExp,
  callback: (params: Record<string, string>) => Promise<Response>,
): Promise<Response> => {
  const params = parseParams(event, rawParams, regex);

  for (const param in params) {
    if (!params[param]) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }
  }

  return callback(params as Record<string, string>);
};
