<script lang="ts">
  import type { Component } from '../../Entity/Components/types';
  import ComponentValueEditor from './ComponentValueEditor.svelte';

  const components: Component[] = [
    {
      type: 'Transform3D',
      values: {
        Position: { x: 0, y: 5, z: -10 },
        Rotation: { x: 0, y: 0, z: 0 },
        Scale: { x: 1, y: 1, z: 1 },
      },
    },
    {
      type: 'PhysicsBody2D',
      values: {
        Velocity: { x: 2, y: 0 },
        Acceleration: { x: 0, y: -9.8 },
        Mass: 5,
        IsKinematic: false,
      },
    },
    {
      type: 'Camera2D',
      values: {
        Zoom: 1.5,
        Offset: { x: 0, y: 0 },
        Rotation: 0,
      },
    },
    {
      type: 'Health',
      values: {
        Current: 75,
        Max: 100,
      },
    },
    {
      type: 'InputState',
      values: {
        Move: { x: 0, y: 1 },
        Look: { x: 0.2, y: 0 },
        Jump: false,
        Fire: true,
      },
    },
  ];
</script>

<div class="bg-neutral-900 h-full w-full text-md py-1 overflow-y-scroll">
  {#each components as component (component.type)}
    <ComponentValueEditor {component} />
  {/each}
  <div class="flex mx-4 my-4 justify-center">
    <button class="cursor-pointer bg-neutral-800 w-full h-10 font-semibold rounded-md">
      Add component
    </button>
  </div>
</div>
