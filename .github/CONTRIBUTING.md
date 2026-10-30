# Contributing

If you wish to contribute to the NanoForge project, fork the repository and submit a pull request. Please mind following the pre-commit hooks to keep the codebase as clean as possible.

## Setup

To get ready to work on the codebase, please do the following:

1. Fork & clone the repository, and make sure you're on the **main** branch
2. Run `pnpm install --frozen-lockfile` ([install](https://pnpm.io/installation)), then `pnpm setup:check`: it says what else is missing (Bun, Chrome, a built engine for the tests that play games: `pnpm setup:engine`)
3. Optionally, copy `.env.example` to `.env`: every variable is listed there, commented out with its default; uncomment what you change
4. Run the editor `pnpm run dev`
5. Make your changes
6. Run `pnpm format && pnpm build && pnpm test` to run ESLint/Prettier, build and tests
7. [Submit a pull request](https://github.com/NanoForge-dev/Editor/compare) (Make sure you follow the [conventional commit format](https://github.com/NanoForge-dev/Editor/blob/main/.github/COMMIT_CONVENTION.md))
