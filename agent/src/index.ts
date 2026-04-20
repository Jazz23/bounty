import { createDeepAgent } from "deepagents";
import { weatherTool } from "./tools";

const agent = createDeepAgent({
    model: "gemini-3.1-flash-lite-preview",
    tools: [weatherTool]
})

const result = await agent.invoke({
    messages: [{ role: "user", content: "What is the weather?" }]
})

console.log(result)