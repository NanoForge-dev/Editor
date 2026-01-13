import type { Component } from '../Entity/Components/types';

export const components: Component[] = [
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
      Velocity: { x: 2, y: 2 },
      Acceleration: { x: 0, y: 0 },
      Mass: 25,
      IsKinematic: false,
    },
  },
  {
    type: 'Camera2D',
    values: {
      Zoom: 1,
      Offset: { x: 15, y: 30 },
      Rotation: { x: 0, y: 0, z: -45 },
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
      Move: { x: 1, y: 1 },
      Look: { x: 0.2, y: 0 },
      Jump: true,
      Fire: false,
    },
  },
];
