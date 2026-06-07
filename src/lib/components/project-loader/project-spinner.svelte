<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
</script>

<Card.Root class="flex flex-col items-center p-6 animate-spin scale-150">
  <Card.Header class="flex flex-col items-center text-center">
    <Spinner />
    <Card.Title>Project loading...</Card.Title>
    <Card.Description>Retrieving save</Card.Description>
  </Card.Header>

  <Card.Content class="mt-4">
    <Button
      variant="outline"
      size="sm"
      onclick={() => {
        goto(resolve('/'));
      }}
    >
      Cancel
    </Button>
  </Card.Content>
</Card.Root>
