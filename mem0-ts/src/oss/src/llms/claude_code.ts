import { query } from "@anthropic-ai/claude-agent-sdk";
import { LLM, LLMResponse } from "./base";
import { LLMConfig, Message } from "../types";

export class ClaudeCodeLLM implements LLM {
  private model: string;
  private maxTokens: number;
  private allowedTools: string[];

  constructor(config: LLMConfig) {
    this.model = config.model || "claude-sonnet-4-5-20250929";
    this.maxTokens = config.modelProperties?.maxTokens || 4096;

    // Allow Claude Code to use Read, Grep, Glob for context when generating memories
    this.allowedTools = config.modelProperties?.allowedTools || [
      "Read",
      "Grep",
      "Glob",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
    ];
  }

  async generateResponse(
    messages: Message[],
    responseFormat?: { type: string },
    tools?: any[],
  ): Promise<string | LLMResponse> {
    // Extract system message if present
    const systemMessage = messages.find((msg) => msg.role === "system");
    const otherMessages = messages.filter((msg) => msg.role !== "system");

    // Build the prompt for Claude Code
    let prompt = "";

    // Add message history
    for (const msg of otherMessages) {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : msg.content.image_url.url;

      if (msg.role === "user") {
        prompt += `User: ${content}\n\n`;
      } else if (msg.role === "assistant") {
        prompt += `Assistant: ${content}\n\n`;
      }
    }

    // Build system prompt with JSON formatting instructions if needed
    let systemPrompt = "";
    if (systemMessage && typeof systemMessage.content === "string") {
      systemPrompt = systemMessage.content;
    }

    if (responseFormat?.type === "json_object") {
      systemPrompt +=
        "\n\nIMPORTANT: You MUST respond with valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text. Your entire response should be parseable JSON.";
    }

    try {
      // Use the Claude Agent SDK to query Claude Code
      const agentQuery = query({
        prompt: prompt.trim(),
        options: {
          model: this.model,
          systemPrompt: systemPrompt || undefined,
          allowedTools: this.allowedTools,
          maxTurns: 1, // Single turn for memory generation
          includePartialMessages: false,
          permissionMode: "bypassPermissions", // Allow tool usage without prompting
          settingSources: [], // Don't load project settings or hooks to prevent recursion
        },
      });

      let responseContent = "";
      let toolCallsDetected: Array<{ name: string; arguments: string }> = [];

      // Stream the response
      for await (const message of agentQuery) {
        if (message.type === "assistant") {
          // Extract text content from APIAssistantMessage
          for (const block of message.message.content) {
            if (block.type === "text") {
              responseContent += block.text;
            } else if (block.type === "tool_use") {
              // Track tool calls if present
              toolCallsDetected.push({
                name: block.name,
                arguments: JSON.stringify(block.input),
              });
            }
          }
        }
      }

      // If JSON format was requested, validate and extract JSON
      if (responseFormat?.type === "json_object") {
        // Try to extract JSON from the response
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseContent = jsonMatch[0];
        }

        // Validate it's valid JSON
        try {
          JSON.parse(responseContent);
        } catch (e) {
          throw new Error(
            `Claude Code did not return valid JSON: ${responseContent}`,
          );
        }
      }

      // Return with tool calls if present
      if (toolCallsDetected.length > 0) {
        return {
          content: responseContent,
          role: "assistant",
          toolCalls: toolCallsDetected,
        };
      }

      // Return plain string response
      return responseContent;
    } catch (error) {
      throw new Error(
        `Claude Code LLM provider error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async generateChat(messages: Message[]): Promise<LLMResponse> {
    const response = await this.generateResponse(messages);

    if (typeof response === "string") {
      return {
        content: response,
        role: "assistant",
      };
    }

    return response;
  }
}
