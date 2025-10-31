import dotenv from "dotenv";
import { ClaudeCodeLLM } from "../../src/llms/claude_code";

// Load environment variables
dotenv.config();

async function testClaudeCode() {
  console.log("Testing Claude Code LLM implementation...");
  console.log("This uses the Claude Agent SDK to spawn Claude Code sessions");
  console.log(
    "Note: Agent SDK uses the authenticated 'claude' CLI, no API key needed\n",
  );

  // Initialize ClaudeCodeLLM
  const claudeCode = new ClaudeCodeLLM({
    model: "claude-sonnet-4-5-20250929",
    modelProperties: {
      maxTokens: 4096,
      // Allow Claude Code to use tools for context
      allowedTools: ["Read", "Grep", "Glob", "Bash(ls:*)", "Bash(cat:*)"],
    },
  });

  try {
    // Test 1: Simple chat completion
    console.log("=".repeat(60));
    console.log("Test 1: Simple chat completion");
    console.log("=".repeat(60));
    const chatResponse = await claudeCode.generateChat([
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "user",
        content: "What is the capital of France? Answer in one sentence.",
      },
    ]);

    console.log("Chat response:");
    console.log(`Role: ${chatResponse.role}`);
    console.log(`Content: ${chatResponse.content}\n`);

    // Test 2: JSON response format (for memory extraction)
    console.log("=".repeat(60));
    console.log("Test 2: JSON response format (memory extraction)");
    console.log("=".repeat(60));
    const memoryPrompt = `
Extract the key facts from this conversation and return them as JSON:

User: "Hi, my name is Em and I'm a software engineer at Automattic. I love working with TypeScript and building AI tools."

Return a JSON object with this structure:
{
  "facts": [
    { "category": "personal", "fact": "..." },
    { "category": "professional", "fact": "..." }
  ]
}
    `.trim();

    const jsonResponse = await claudeCode.generateResponse(
      [
        {
          role: "system",
          content:
            "You are a memory extraction assistant. Extract key facts and return only valid JSON.",
        },
        { role: "user", content: memoryPrompt },
      ],
      { type: "json_object" }, // Request JSON format
    );

    console.log("JSON response:");
    console.log(
      typeof jsonResponse === "string" ? jsonResponse : jsonResponse.content,
    );

    // Validate it's valid JSON
    const parsed = JSON.parse(
      typeof jsonResponse === "string" ? jsonResponse : jsonResponse.content,
    );
    console.log("\n✅ Valid JSON received!");
    console.log("Extracted facts:", parsed);

    // Test 3: Context-aware response (Claude Code can read files)
    console.log("\n" + "=".repeat(60));
    console.log("Test 3: Context-aware memory generation");
    console.log("=".repeat(60));
    const contextResponse = await claudeCode.generateResponse([
      {
        role: "system",
        content:
          "You are a memory assistant. You can use Read, Grep, and other tools to gather context before generating memories.",
      },
      {
        role: "user",
        content:
          "Based on the package.json file in the current directory (/tmp/mem0/mem0-ts), what is this project about? Return a brief 1-sentence summary.",
      },
    ]);

    console.log("Context-aware response:");
    console.log(
      typeof contextResponse === "string"
        ? contextResponse
        : contextResponse.content,
    );

    console.log("\n" + "=".repeat(60));
    console.log("✅ All tests completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error testing Claude Code LLM:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack:", error.stack);
    }
  }
}

testClaudeCode().catch(console.error);
