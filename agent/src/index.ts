import { createDeepAgent, FilesystemBackend } from "deepagents";
import { weatherTool } from "./tools";

const agent = createDeepAgent({
    model: "openai:gpt-5.4-mini",
    tools: [weatherTool],
    backend: new FilesystemBackend({
        rootDir: "./workspace", // Will be cloned repo
        virtualMode: true
    })
});

const result = await agent.invoke({
    messages: [{ role: "user", content: "Run ls." }]
});

for (const msg of result.messages) {
    const role = (msg as any)._getType?.() ?? msg.constructor?.name ?? "message";
    console.log(`\n--- ${role} ---`);

    const toolCalls = (msg as any).tool_calls;
    if (toolCalls?.length) {
        for (const tc of toolCalls) {
            console.log(`[tool call] ${tc.name}(${JSON.stringify(tc.args)})`);
        }
    }

    if (msg.content) {
        if (typeof msg.content === "string") {
            console.log(msg.content);
        } else if (Array.isArray(msg.content)) {
            for (const block of msg.content as any[]) {
                if (block.type === "thinking") {
                    console.log(`[thinking] ${block.thinking}`);
                } else if (block.type === "text") {
                    console.log(block.text);
                } else {
                    console.log(JSON.stringify(block));
                }
            }
        }
    }
}