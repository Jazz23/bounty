## PR Review

### Summary
This PR shifts the agent from a demo weather-tool app into a GitHub PR review tool. The overall direction is reasonable, but there are a few correctness and robustness issues that should be addressed before merge.

### Findings

#### 1. `--debug` parsing only works if it appears before the subcommand
`src/index.ts` parses `--debug` from the full argv list before selecting the command, but `handleReviewCommand` still assumes exactly one positional arg. This means invocations like:

```bash
bun run src/index.ts review https://github.com/... --debug info
```

will fail with the usage message, even though the usage text suggests this should work. In practice, users will likely place flags after the subcommand, so this is a usability bug.

**Suggestion:** Parse command-level flags after the subcommand, or strip `--debug` from `rest` as well.

---

#### 2. The diff fetch does not validate the PR was still at the same head/base it just cloned
The code fetches PR metadata, then fetches the diff, then clones the branch by name. This is better than cloning first, but it still does not guarantee the checked-out code matches the metadata used to produce the review prompt. Branch names are mutable, and a force-push between the API fetch and `git clone --branch ${headRef}` can cause the clone to resolve to a different commit than `headSha`.

This matters because the prompt tells the agent it is reviewing `headSha` / `baseSha`, but the actual filesystem may contain a newer commit if the branch moved.

**Suggestion:** Clone by SHA when possible, or after cloning verify `HEAD` matches `headSha` and fail if it does not. If the goal is to review a specific PR snapshot, the current behavior is not strict enough.

---


#### 5. `agent/test/Dockerfile.dev` appears to have an invalid `COPY` source layout
The new Dockerfile uses:

```dockerfile
COPY ../package.json ../bun.lock ./
```

But build context is set to `"$AGENT_DIR"` and Dockerfile lives under `agent/test/Dockerfile.dev`. Docker `COPY` sources are resolved relative to the build context, not the Dockerfile location. Since `../package.json` and `../bun.lock` are outside the build context, this will fail in a normal Docker build.

The script currently does:

```sh
docker build -f "$SCRIPT_DIR/Dockerfile.dev" -t "$IMAGE" "$AGENT_DIR"
```

so the context is the `agent` directory. Those `../...` paths are not valid in that context.

**Suggestion:** Change the build context or update the `COPY` paths to be relative to the context root, e.g. `COPY package.json bun.lock ./`.

---

#### 6. `reviewPR` exits on API failures but doesn’t handle network exceptions consistently
`fetch(...)` can throw on network issues, DNS failures, or other runtime exceptions. Right now only `response.ok` is checked. That means some failures will produce an unhandled exception rather than the controlled error handling the rest of the command uses.

**Suggestion:** Wrap the GitHub API calls and clone operation in a top-level `try/catch` and report a useful error before exiting.

---

### Smaller notes
- `baseSha` is only used in the prompt, which is fine, but if the tool is meant to review the exact PR snapshot, it may be useful to verify the base commit too.
- The `debugMode` parameter is passed into `reviewPR` but only used for the verbose branch; consider simplifying if `info` and `verbose` are the only meaningful modes.
- `agent/src/pr.ts` imports `FilesystemBackend` with `virtualMode: true`, which is fine, but if the review agent needs to write artifacts or inspect generated files, that behavior should be explicitly considered.

### Conclusion
The PR is directionally good, but I’d block merge until the Dockerfile path issue is fixed and the PR snapshot consistency issue is addressed. The CLI flag handling and output formatting are also worth tightening so the command behaves predictably for users.
