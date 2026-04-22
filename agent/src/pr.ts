import { createDeepAgent, FilesystemBackend } from "deepagents";
import { tmpdir } from "os";
import { join } from "path";

export async function handleReviewCommand(
    args: string[],
    log: (msg: string) => void,
    debugMode: "none" | "info" | "verbose"
) {
    const [prUrl] = args;
    if (!prUrl) {
        console.error("Usage: bun run src/index.ts review <github-pr-url> [--debug info|verbose]");
        process.exit(1);
    }

    let owner: string, repo: string, prNumber: string;
    try {
        const url = new URL(prUrl);
        if (url.hostname !== "github.com") throw new Error("hostname must be github.com");
        const [ownerPart, repoPart, pullLiteral, prNumPart] = url.pathname.split("/").filter(Boolean);
        if (!ownerPart || !repoPart || pullLiteral !== "pull" || !prNumPart || !/^\d+$/.test(prNumPart)) {
            throw new Error("pathname must be /:owner/:repo/pull/:number");
        }
        owner = ownerPart;
        repo = repoPart;
        prNumber = prNumPart;
    } catch {
        console.error("Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123");
        process.exit(1);
    }

    await reviewPR(owner, repo, prNumber, log, debugMode);
}

async function reviewPR(
    owner: string,
    repo: string,
    prNumber: string,
    log: (msg: string) => void,
    debugMode: "none" | "info" | "verbose"
) {
    log(`Fetching PR #${prNumber} from ${owner}/${repo}...`);

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
    );

    if (!response.ok) {
        console.error(`Failed to fetch PR: ${response.status} ${response.statusText}`);
        process.exit(1);
    }

    const pr = (await response.json()) as any;
    const headRef = pr.head.ref as string;
    const baseCloneUrl = pr.base.repo.clone_url as string;

    const cloneDir = join(tmpdir(), `review-${owner}-${repo}-${prNumber}`);

    await Bun.$`rm -rf ${cloneDir}`.quiet();

    log(`Cloning ${owner}/${repo} and checking out PR #${prNumber} ("${headRef}")...`);
    try {
        await Bun.$`git clone --depth=1 ${baseCloneUrl} ${cloneDir}`.quiet();
        await Bun.$`git -C ${cloneDir} fetch origin refs/pull/${prNumber}/head`.quiet();
        await Bun.$`git -C ${cloneDir} checkout FETCH_HEAD`.quiet();
    } catch (e) {
        console.error(
            `Failed to clone ${owner}/${repo} for PR #${prNumber} (${baseCloneUrl}): ${e instanceof Error ? e.message : e}`
        );
        process.exit(1);
    }

    const diffResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers: { Accept: "application/vnd.github.v3.diff" } }
    );

    if (!diffResponse.ok) {
        console.error(`Failed to fetch PR diff: ${diffResponse.status} ${diffResponse.statusText}`);
        process.exit(1);
    }

    const diffContent = await diffResponse.text();
    const diffPath = join(cloneDir, "pr.diff");
    await Bun.write(diffPath, diffContent);

    log("Starting review...\n");

    const agent = createDeepAgent({
        model: "openai:gpt-5.4-mini",
        backend: new FilesystemBackend({
            rootDir: cloneDir,
            virtualMode: true,
        }),
    });

    const input = {
        messages: [
            {
                role: "user",
                content: `Review pull request #${prNumber} on ${owner}/${repo}. The PR branch "${headRef}" has been cloned into your filesystem. A diff of all changes in this PR has been written to "pr.diff" at the root of the repository — start by reading that file to understand exactly what changed, then explore the relevant source files for deeper context. Identify issues and provide a thorough code review with actionable feedback. Reply in markdown syntax.`,
            },
        ]
    };

    if (debugMode === "verbose") {
        for await (const chunk of await agent.stream(input, { streamMode: "values" })) {
            console.log(chunk);
        }
    } else {
        const result = await agent.invoke(input);
        const lastMessage = result.messages.at(-1);
        if (lastMessage) console.log(lastMessage.content);
    }
}
