# ADR 0007 — Eager file hashes

- Status: accepted (2026-11-05)
- Related: PR #214 (`feat/add-cache-system`, the OPFS content cache),
  `packages/server-core/src/fs/fs-service.ts`, `packages/server-core/src/fs/file-hashes.ts`,
  `packages/project/src/fs/project-fs.ts`

## Context

The client keeps file contents in an OPFS cache keyed by sha1. It can serve a file from that cache
only when it knows the file's current hash, so someone has to compute that hash: when the project is
listed, or when a file is read.

What the code does at this point:

- `FsService.list()` walks the tree and stats each entry, then hashes the regular files, 8 at a time,
  before it returns the listing. It leaves out `.git`, symlinks and ignored paths (`.nfignore`), and
  does not descend into `node_modules` in recursive listings. It lists without a hash the files of
  the trash, files over `MAX_READ_BYTES` (64 MiB) and files it can't read.
- `FileHashes` keeps one sha1 per absolute path, valid for one version of the file (size, `mtimeMs`,
  `ctimeMs`, inode). It holds at most 50 000 entries, least recently used out first, shared by every
  project of the server, and saves them to `DATA_DIR/file-hashes.json`. A file whose version did not
  change is not read again, even after a restart.
- `ProjectFs.refresh()` loads the tree with `list`. `ProjectFs._fetch()` serves a file from the
  content cache, with no request, when the tree's hash is in the cache. Otherwise it calls
  `readMany`. A `fresh` read sends the cached hash as `knownHash`, and `_readOne` answers
  `notModified` when it is still current.

## Decision

The server computes every file's hash when the project is listed (eager), not when a file is read
(lazy).

The project owner prefers one longer load when a project opens to many small waits afterwards. Once
the tree is there, every file whose content is cached opens straight from the cache, with no request
to the server.

## Alternatives considered

1. **Lazy hashing.** `list` returns only the hashes `FileHashes` already knows for the current version,
   and reads nothing. The client keeps the previous tree's hash as an untrusted candidate and sends it
   as `knownHash` to `readMany`, which hashes that one file and answers `notModified`. A project open
   costs only stats; each file costs one round trip on its first read after a version change. Not
   chosen: it trades the one-time load for a request on each first file open, and the owner prefers
   to pay up front.
2. **Hashing in the background after `list` returns.** The client would need a way to receive hashes
   later (a push over the change stream). More code for the same gain as either option above.

## Consequences

- Opening a project reads every byte of every file whose hash is not cached, so that time grows with
  the size of the project's assets. It happens on the first open, for the files whose ctime or inode
  changed (the files a git checkout or pull rewrites, a restored backup, copies), and on every open when the
  projects of the server hold more than 50 000 files together (least recently used entries are
  evicted, then hashed again).
- After that, a project open costs only stats, and opening a file costs no server request when its
  content is in the OPFS cache.
- Revisit if large projects take too long to open, or for the hosted editor (phase 14), where reads
  are slower and alternative 1 becomes more attractive.
- **Open item, not part of this change:** `FileHashes._load` drops the older `file-hashes.json`
  format (`[key, hash]` pairs, keyed by `${absolute}\0${size}\0${mtimeMs}\0${ctimeMs}\0${ino}`). Only
  builds of PR #214 from before its review (its commit "feat: add cache system with OPFS") wrote
  that format; `main` never had a `file-hashes.json`. Converting it would be simple (split the key
  at the first `\0`, the path before it and the version after it, later entries being more recent),
  but it only spares those builds' users one more full hash of their projects on the next launch.
