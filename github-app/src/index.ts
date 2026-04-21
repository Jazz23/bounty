import { App } from "@octokit/app";
import { $ } from "bun";


const app = new App({
  appId: process.env.APP_ID!,
  privateKey: process.env.PRIVATE_KEY!,        // contents of the .pem file
  webhooks: { secret: process.env.WEBHOOK_SECRET! },
});

async function invokeAgent(): Promise<string> {
  if (process.env.NODE_ENV === "development") {
    return await $`docker run --rm --env-file ../agent/.env.local -v ../agent/src:/app/src -v ../agent/node_modules:/app/node_modules -v ../agent/package.json:/app/package.json ${process.env.AGENT_IMAGE}`.text();
  } else {
    return "wip";
  }
}

// Listen for new issues and post a comment
app.webhooks.on("issues.opened", async ({ octokit, payload }) => {
  console.log("issue received");
  await octokit.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: "Thanks for opening this issue! We'll look into it soon.",
      headers: { "x-github-api-version": "2022-11-28" },
    }
  );
});

// The octokit instance above is already pre-authenticated as the installation
// — no manual token management needed

Bun.serve({
  routes: {
    "/webhook": {
      POST: async (req) => {
        await app.webhooks.verifyAndReceive({
          id: req.headers.get("x-github-delivery")!,
          name: req.headers.get("x-github-event") as any,
          signature: req.headers.get("x-hub-signature-256")!,
          payload: await req.text(),
        });
        return new Response("ok");
      },
    },
  },
});
