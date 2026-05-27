import { Exception } from '@utils/exception';

import { useRequestHandler } from '@utils-server/request-handler';

/**
 * To request a project file, use the following URL:
 * /fs/project?path=path/to/file
 * The path must be relative to /client
 * Only the client is handled for now
 */
export const GET = useRequestHandler(({ event, project }) => {
  const path = event.url.searchParams.get('path');
  if (!path) throw new Exception('Bad Request', 'Missing path query param', 400);

  const file = project.client.fs.getFile(decodeURIComponent(path).replace(/\?url$/, ''));

  const stream = file.readStream();

  return new Response(stream);
});
