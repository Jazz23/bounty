import { createDeepAgent, FilesystemBackend } from "deepagents";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { tmpdir } from "os";
import { join } from "path";

const outputReviewTool = tool(
    async ({ review }: { review: string }) => {
        process.stdout.write(review + "\n");
        process.exit(0);
    },
    {
        name: "output_review",
        description: "Output the completed PR review in markdown format to stdout and exit. You MUST call this tool exactly once when your review is complete.",
        schema: z.object({
            review: z.string().describe("The complete PR review in markdown format"),
        }),
    }
);

export async function handleReviewCommand(
    args: string[],
    log: (msg: string) => void,
    debugMode: "none" | "info" | "verbose"
) {
    if (args.length !== 1) {
        console.error("Usage: bun run src/index.ts review <github-pr-url> [--debug info|verbose]");
        process.exit(1);
    }
    const prUrl = args[0]!;

    let owner: string, repo: string, prNumber: string;
    try {
        const url = new URL(prUrl);
        if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
            throw new Error("hostname must be github.com");
        }
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
    const headSha = pr.head.sha as string;
    const baseSha = pr.base.sha as string;
    const headCloneUrl = pr.head.repo.clone_url as string;

    // Fetch diff immediately after metadata so both reflect the same PR state
    const diffResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers: { Accept: "application/vnd.github.v3.diff" } }
    );

    if (!diffResponse.ok) {
        console.error(`Failed to fetch PR diff: ${diffResponse.status} ${diffResponse.statusText}`);
        process.exit(1);
    }

    const diffContent = await diffResponse.text();

    const cloneDir = join(tmpdir(), `review-${owner}-${repo}-${prNumber}`);

    await Bun.$`rm -rf ${cloneDir}`.quiet();

    log(`Cloning PR #${prNumber} head (${headRef} @ ${headSha.slice(0, 7)})...`);
    try {
        await Bun.$`git clone --depth=1 --branch ${headRef} ${headCloneUrl} ${cloneDir}`.quiet();
    } catch (e) {
        console.error(
            `Failed to clone PR head (${headCloneUrl}): ${e instanceof Error ? e.message : e}`
        );
        process.exit(1);
    }

    const diffPath = join(cloneDir, "pr.diff");
    await Bun.write(diffPath, diffContent);

    log("Starting review...\n");

    const agent = createDeepAgent({
        model: "openai:gpt-5.4-mini",
        tools: [outputReviewTool],
        backend: new FilesystemBackend({
            rootDir: cloneDir,
            virtualMode: true,
        }),
    });

    const input = {
        messages: [
            {
                role: "user",
                content: `Review pull request #${prNumber} on ${owner}/${repo}. Head: ${headSha}, base: ${baseSha}. The PR branch "${headRef}" has been cloned into your filesystem at that exact head commit. A diff of all changes in this PR has been written to "pr.diff" at the root of the repository — start by reading that file to understand exactly what changed, then explore the relevant source files for deeper context. Identify issues and provide a thorough code review with actionable feedback. When you are done, you MUST call the output_review tool with your complete review in markdown format.`,
            },
        ]
    };

    if (debugMode === "verbose") {
        for await (const chunk of await agent.stream(input, { streamMode: "values" })) {
            console.error(JSON.stringify(chunk));
        }
    } else {
        await agent.invoke(input);
    }
}
