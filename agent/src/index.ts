import { createDeepAgent, FilesystemBackend } from "deepagents";
import { weatherTool } from "./tools";
import { tmpdir } from "os";
import { join } from "path";

const [command, prUrl] = process.argv.slice(2);

if (!command || command !== "review") {
    console.error(`Usage: bun run src/index.ts review <github-pr-url>`);
    process.exit(1);
}

if (!prUrl) {
    console.error("Usage: bun run src/index.ts review <github-pr-url>");
    process.exit(1);
}

const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
if (!match) {
    console.error("Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123");
    process.exit(1);
}

const [, owner, repo, prNumber] = match;

console.log(`Fetching PR #${prNumber} from ${owner}/${repo}...`);

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
const cloneUrl = pr.head.repo.clone_url as string;

const cloneDir = join(tmpdir(), `review-${owner}-${repo}-${prNumber}`);

if (await Bun.file(cloneDir).exists()) {
    await Bun.$`rm -rf ${cloneDir}`.quiet();
}

console.log(`Cloning branch "${headRef}" into ${cloneDir}...`);
await Bun.$`git clone --depth=1 --branch ${headRef} ${cloneUrl} ${cloneDir}`.quiet();

console.log("Starting review...\n");

const agent = createDeepAgent({
    model: "openai:gpt-5.4-mini",
    tools: [weatherTool],
    backend: new FilesystemBackend({
        rootDir: cloneDir,
        virtualMode: true,
    }),
});

const result = await agent.invoke({
    messages: [
        {
            role: "user",
            content: `Review pull request #${prNumber} on ${owner}/${repo}. The PR branch "${headRef}" has been cloned into your filesystem. Explore the code, identify issues, and provide a thorough code review with actionable feedback. Reply in markdown syntax.`,
        },
    ],
});

const last = result.messages.at(-1);
if (last?.content) {
    if (typeof last.content === "string") {
        console.log(last.content);
    } else if (Array.isArray(last.content)) {
        for (const block of last.content as any[]) {
            if (block.type === "text") console.log(block.text);
        }
    }
}
