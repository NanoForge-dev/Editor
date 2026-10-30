import type { z } from 'zod';

import type { TourSchema } from '@nanoforge-dev/editor-ui';

export const TUTORIAL_TOUR_ID = 'tutorial';

const LOCAL = 'editor.local';
const HOSTED = '!editor.local';

/**
 * The tutorial (_Help › Tutorial_): on its own project (`projects.createTutorial`) in a local
 * editor, the screens, an entity added, a value changed, the planted mistake fixed, the game
 * played and looked into, then committed. A hosted editor gets the steps that work on any
 * project.
 */
export const TUTORIAL_TOUR: z.input<typeof TourSchema> = {
  id: TUTORIAL_TOUR_ID,
  title: 'Tutorial',
  steps: [
    {
      id: 'welcome',
      when: LOCAL,
      title: 'Your first game',
      text: 'This project has an orange ball that should bounce, and one mistake that keeps it still. The tour shows you around while you fix it. Follow the steps, or go on with Next.',
    },
    {
      id: 'welcome-hosted',
      when: HOSTED,
      title: 'A tour of the editor',
      text: 'A few steps on this project: the screens, adding an entity, changing a value and editing the code. Follow the steps, or go on with Next.',
    },
    {
      id: 'screens',
      title: 'Screens',
      text: 'The editor has a few screens: Scene shows the entities your code makes, Game plays it, Script edits the code and Project holds the apps and settings. Only the main panels are shown at first: View › Panels opens the others.',
      target: { role: 'tablist', name: 'Main screens' },
    },
    {
      id: 'scene',
      title: 'The Scene screen',
      text: 'Open the Scene screen.',
      target: { role: 'tab', name: 'Scene' },
      advanceWhen: "screen == 'viewport.scene'",
    },
    {
      id: 'add-entity',
      title: 'Add an entity',
      text: 'An entity is a thing in your game. Add one with Add entity (+) in the Hierarchy: the editor writes the code for it in main.ts.',
      action: { title: 'Show Hierarchy', command: 'workbench.openWidget', args: ['ecs.hierarchy'] },
      target: { role: 'button', name: 'Add entity' },
      advanceWhenChanged: 'ecs.entityCount',
    },
    {
      id: 'select-ball',
      when: LOCAL,
      title: 'Select the ball',
      text: 'Click ball in the Hierarchy. The Inspector then shows its components: where it is, how it moves and how it is drawn.',
      action: { title: 'Show Hierarchy', command: 'workbench.openWidget', args: ['ecs.hierarchy'] },
      target: { role: 'treeitem', name: 'ball', exact: false, within: { role: 'tree', name: 'Entities' } },
    },
    {
      id: 'select-hosted',
      when: HOSTED,
      title: 'Select an entity',
      text: 'Click an entity in the Hierarchy. The Inspector then shows its components.',
      action: { title: 'Show Hierarchy', command: 'workbench.openWidget', args: ['ecs.hierarchy'] },
      target: { role: 'tree', name: 'Entities' },
    },
    {
      id: 'change-value',
      when: LOCAL,
      title: 'Change a value',
      text: 'Change a number in the Inspector, say the ball\'s speed in Velocity2D. The code follows: undo with Ctrl+Z if you want it back.',
      target: { role: 'region', name: 'Inspector' },
      advanceWhenChanged: 'ecs.revision',
    },
    {
      id: 'change-value-hosted',
      when: HOSTED,
      title: 'Change a value',
      text: 'Change a value in the Inspector. The code follows: undo with Ctrl+Z if you want it back.',
      target: { role: 'region', name: 'Inspector' },
      advanceWhenChanged: 'ecs.revision',
    },
    {
      id: 'fix',
      when: LOCAL,
      title: 'Fix the mistake',
      text: 'Problems lists what TypeScript found: move2D reads velocity.speed, which Velocity2D does not have. Open it from Problems and write velocity.x instead.',
      target: { role: 'region', name: 'Problems' },
      action: { title: 'Show problems', command: 'console.showProblems' },
      /** Not `!problems.hasErrors`: true too before the first diagnostics. */
      advanceWhen: 'problems.hasErrors == false',
    },
    {
      id: 'code-hosted',
      when: HOSTED,
      title: 'Edit the code',
      text: 'Open a file from Files to edit it on the Script screen. Problems lists what TypeScript finds, and a click there opens the line.',
      target: { role: 'tab', name: 'Script' },
    },
    {
      id: 'play',
      when: LOCAL,
      title: 'Play',
      text: 'Play builds the game and runs it on the Game screen. The ball moves now.',
      target: { role: 'toolbar', name: 'Run' },
      advanceWhen: "runtime.state == 'running' && runtime.controllable",
    },
    {
      id: 'no-bridge',
      when: `${LOCAL} && runtime.active && !runtime.controllable`,
      title: 'A game without the editor bridge',
      text: 'The game runs, but its editor library is older than this editor: World, Pause and Stop need the bridge it lacks. Run › Reload editor runtime ends the game.',
    },
    {
      id: 'world',
      when: `${LOCAL} && runtime.controllable`,
      title: 'Look inside the running game',
      text: 'World shows the entities of the running game and their values, live. Stop the game with Stop when you are done.',
      action: { title: 'Show World', command: 'workbench.openWidget', args: ['inspectors.world'] },
      target: { role: 'region', name: 'World' },
    },
    {
      id: 'init',
      when: `${LOCAL} && !git.repository`,
      title: 'Keep your work in git',
      text: 'Git keeps every version of your project. Make this project a repository first.',
      action: { title: 'Initialize repository', command: 'git.init' },
      advanceWhen: 'git.repository',
    },
    {
      id: 'commit',
      when: LOCAL,
      title: 'Commit',
      text: 'A commit saves the current version. Tick the files to keep (Unversioned files: all of them), write a message such as "my first game", then Commit.',
      action: { title: 'Show Commit', command: 'git.commit' },
      target: { role: 'region', name: 'Commit' },
      advanceWhenChanged: 'git.head',
    },
    {
      id: 'done',
      title: 'Done',
      text: 'That is the tour. Help › Tutorial plays it again, and Help › Documentation tells the rest.',
    },
  ],
};
