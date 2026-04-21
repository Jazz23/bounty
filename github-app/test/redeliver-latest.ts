import { App } from "@octokit/app";

const eventFlag = process.argv.indexOf("--event");
const eventArg = eventFlag !== -1 ? process.argv[eventFlag + 1] : undefined;

if (eventFlag !== -1 && !eventArg) {
  console.error("Error: --event requires a value (e.g. --event issues or --event issues.opened)");
  process.exit(1);
}

const [eventFilter, actionFilter] = eventArg?.split(".") ?? [];

const app = new App({
  appId: process.env.APP_ID!,
  privateKey: process.env.PRIVATE_KEY!,
  webhooks: { secret: process.env.WEBHOOK_SECRET! },
});

async function findLatestDelivery() {
  let cursor: string | undefined;

  do {
    const response = await app.octokit.request("GET /app/hook/deliveries", {
      headers: { "x-github-api-version": "2022-11-28" },
      per_page: 100,
      ...(cursor ? { cursor } : {}),
    });

    const deliveries = response.data;

    if (deliveries.length === 0) break;

    const match = eventFilter
      ? deliveries.find((d: any) => d.event === eventFilter && (!actionFilter || d.action === actionFilter))
      : deliveries[0];

    if (match) return match;

    // Extract next cursor from Link header
    const link = (response.headers as any)["link"] as string | undefined;
    const next = link?.match(/<[^>]+[?&]cursor=([^&>]+)[^>]*>;\s*rel="next"/);
    cursor = next?.[1];
  } while (cursor);

  return null;
}

const delivery = await findLatestDelivery();

if (!delivery) {
  console.log(
    eventFilter
      ? `No deliveries found for "${[eventFilter, actionFilter].filter(Boolean).join(".")}".`
      : "No webhook deliveries found."
  );
  process.exit(0);
}

console.log(
  `Redelivering delivery ID ${delivery.id} (event: ${delivery.event}, delivered at: ${delivery.delivered_at})`
);

await app.octokit.request("POST /app/hook/deliveries/{delivery_id}/attempts", {
  delivery_id: delivery.id,
  headers: { "x-github-api-version": "2022-11-28" },
});

console.log("Redelivery requested successfully (202 Accepted).");
