import { Exception } from '@utils/exception';

import { useRequestHandler } from '@utils-server/request-handler';

export const GET = useRequestHandler(
  async ({ event, archive }) => {
    const id = event.params.slug;
    if (!id) throw new Exception('Bad Request', 'Missing id param', 400);

    const file = await archive.get(id);

    const stream = file.stream();

    return new Response(stream);
  },
  { projectOptional: true },
);
