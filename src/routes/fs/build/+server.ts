import { Exception } from '@utils-server/exception';
import { useRequestHandler } from '@utils-server/request-handler';

/**
 * To request a built file, use the following URL:
 * /fs/build?path=path/to/file
 * The path must be relative to /.nanoforge/client
 * Only the client is handled for now
 */
export const GET = useRequestHandler(({ event, project }) => {
  const path = event.url.searchParams.get('path');
  if (!path) throw new Exception('Bad Request', 'Missing path query param', 400);

  const file = project.client.loader.getFile(path);

  const stream = file.readStream();

  return new Response(stream);
});
