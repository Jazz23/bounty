import { tool } from "langchain";
import { z } from "zod";

export const weatherTool = tool(
  async () => "deez nuts",
  {
    name: "Weather Tool",
    description: "Tells the weather.",
    schema: z.object({}),
  }
);