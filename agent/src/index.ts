import { createDeepAgent } from "deepagents";
import { weatherTool } from "./tools";

const agent = createDeepAgent({
    model: "google-genai:gemini-3-flash-preview",
    tools: [weatherTool]
})

const result = await agent.invoke({
    messages: [{ role: "user", content: "What is the weather?" }]
})

console.log(result.messages[result.messages.length - 1].content);