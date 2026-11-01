# Usability test

Five people, five tasks, timed, before and after the simpler interfaces of M11. The numbers say whether M11 made the editor easier; the notes say where people still get stuck.

## Builds

Run the same five tasks on two builds, with different people for each (someone who did the tasks once is faster the second time, whatever the build).

| Round  | What it is                                                                  |
| ------ | --------------------------------------------------------------------------- |
| Before | The editor before: every panel open, git labels in title case               |
| After  | The simple layout, screens described, plain-language errors, History closed |

For each round:

```sh
git switch <branch>
pnpm install && pnpm turbo build --filter=@nanoforge-dev/editor...
pnpm example breakout   # http://127.0.0.1:4800, engine from ../engine (NANOFORGE_ENGINE)
```

Before **each person** (stop the editor first):

```sh
rm -rf examples/.data                               # the editor's data: recent projects, account
rm -f examples/breakout/.nanoforge/editor/local.json # breakout's saved layout (not in git)
```

and use a fresh browser profile (a private window), so each one starts from the editor's first run: the previous person's layout would otherwise spoil the comparison.

## People

Five people who make games but have not used this editor: students of the course are a good fit. Note for each one their experience with game engines (none, Unity/Godot, other) and with code editors.

## Tasks

Read each task aloud, then say nothing until they finish or give up (5 minutes per task at most). Ask them to think aloud.

1. **Open the project.** "Open the breakout game: its folder is `breakout`." (The list of recent projects is empty on a first run.)
2. **Add an entity.** "In the Level 1 scene, add a new brick entity." (It must end up in the scene's code.)
3. **Change a value.** "Make the ball start faster." (Any velocity change on the ball counts.)
4. **Play.** "Play the game, then stop it."
5. **Commit.** "Save your work in Git with the message `faster ball`." (The project must be a repository: run `git init && git add -A && git commit -m start` in `examples/breakout` before the session.)

## What to record

For each person and task:

| Measure | How                                                                         |
| ------- | --------------------------------------------------------------------------- |
| Time    | From the end of the instruction to the result on screen (or the give-up)    |
| Done    | Yes, with help (you had to say something), or no                            |
| Errors  | Wrong turns: a wrong panel or menu opened, an action undone, an error shown |
| Notes   | What they looked for and where, what they said, what they misread           |

A sheet per round:

| Person | Experience | Task | Time (s) | Done | Errors | Notes |
| ------ | ---------- | ---- | -------- | ---- | ------ | ----- |
|        |            | 1    |          |      |        |       |

## Reading the results

- Compare the median time and the success rate of each task between the rounds; with five people per round, only large differences mean something.
- The notes matter more than the times: a place where three people looked for the same thing is worth fixing whatever the numbers say.

## After the session

Remove `examples/breakout/.git` and `examples/.data`, and put back anything the people changed in `examples/breakout` (`git checkout examples/breakout`).
