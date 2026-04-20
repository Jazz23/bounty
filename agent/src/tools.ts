import { tool } from "langchain";
import { z } from "zod";

export const weatherTool = tool(
  async () => "Sunny and 75 degrees",
  {
    name: "weather_tool",
    description: "Tells the weather.",
    schema: z.object({}),
  }
);