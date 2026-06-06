import { queryLLM, type LLMMessage } from "../llm/ollama";
import { SYSTEM_PROMPT } from "./prompts";
import { getFormattedSnapshots } from "./memory";

export interface AgentStep {
  thought: string;
  tool: string;
  args: any;
  observation?: any;
}

export interface PlannerResult {
  thought: string;
  tool: string;
  args: any;
}

export async function planNextStep(
  history: LLMMessage[],
  currentQuestion: string,
  steps: AgentStep[],
  provider: "ollama" | "gemini" | "openrouter",
  model: string,
  apiKey?: string
): Promise<PlannerResult> {
  // 1. Get latest historical snapshots to append to system prompt context
  const snapshotsContext = await getFormattedSnapshots(5);
  
  const systemPromptWithContext = `${SYSTEM_PROMPT}\n\nHISTORICAL SNAPSHOTS FROM SQLITE DATABASE:\n${snapshotsContext}`;
  
  const messages: LLMMessage[] = [
    { role: "system", content: systemPromptWithContext },
    ...history,
    { role: "user", content: currentQuestion }
  ];

  // 2. Append intermediate steps to the messages array to keep the ReAct loop context
  for (const step of steps) {
    // Add Assistant thought & tool call
    messages.push({
      role: "assistant",
      content: JSON.stringify({
        thought: step.thought,
        tool: step.tool,
        args: step.args
      })
    });
    
    // Add User response containing the observation
    if (step.observation !== undefined) {
      messages.push({
        role: "user",
        content: `Observation from tool "${step.tool}": ${JSON.stringify(step.observation)}`
      });
    }
  }

  // 3. Query the LLM client with jsonMode enabled
  const responseText = await queryLLM(provider, model, apiKey, messages, true);
  
  try {
    const parsed = JSON.parse(responseText.trim());
    if (parsed.thought === undefined || parsed.tool === undefined || parsed.args === undefined) {
      throw new Error("Missing required JSON properties ('thought', 'tool', 'args')");
    }
    return parsed as PlannerResult;
  } catch (err: any) {
    console.warn(`[Planner] Failed to parse LLM response directly as JSON. Raw response:\n${responseText}`);
    
    // Try to extract JSON if the model added markdown blocks or extra text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0].trim());
        if (parsed.thought !== undefined && parsed.tool !== undefined && parsed.args !== undefined) {
          return parsed as PlannerResult;
        }
      } catch {}
    }
    
    // Fallback if JSON parsing completely fails
    return {
      thought: "The model did not return a valid JSON response structure. Forcing final answer fallback.",
      tool: "final_answer",
      args: {
        message: `Error: OpsisAI encountered an invalid response format from the selected LLM.\n\nRaw output:\n${responseText}`
      }
    };
  }
}
