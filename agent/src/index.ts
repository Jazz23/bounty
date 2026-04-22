import { handleReviewCommand } from "./pr";

const args = process.argv.slice(2);

let debugMode: "none" | "info" | "verbose" = "none";
const debugIndex = args.indexOf("--debug");
if (debugIndex !== -1) {
    const level = args[debugIndex + 1];
    if (level === "info" || level === "verbose") {
        debugMode = level;
        args.splice(debugIndex, 2);
    } else {
        console.error("Usage: --debug <info|verbose>");
        process.exit(1);
    }
}

const log = (msg: string) => { if (debugMode === "info" || debugMode === "verbose") console.error(msg); };

const [command, ...rest] = args;

switch (command) {
    case "review":
        await handleReviewCommand(rest, log, debugMode);
        break;
    default:
        console.error("Usage: bun run src/index.ts <command> [options]");
        console.error("Commands: review");
        process.exit(1);
}
