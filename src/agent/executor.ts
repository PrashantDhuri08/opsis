import { planNextStep, type AgentStep } from "./planner";
import { executeTool } from "../tools";
import { loadHistory, saveMessage } from "./memory";

export interface ExecutionResult {
  response: string;
  steps: AgentStep[];
}

export async function runAgent(
  sessionId: string,
  userQuestion: string,
  provider: "ollama" | "gemini" | "openrouter",
  model: string,
  apiKey: string | undefined,
  maxSteps = 5
): Promise<ExecutionResult> {
  // 1. Load historical messages for this chat session
  const history = await loadHistory(sessionId);

  const steps: AgentStep[] = [];
  let responseMessage = "";

  console.log(
    `[Agent Execution] Starting loop for session: ${sessionId}. Provider: ${provider}, Model: ${model}. Question: "${userQuestion}"`
  );

  for (let i = 0; i < maxSteps; i++) {
    console.log(`[Agent Execution] Step ${i + 1}/${maxSteps}...`);
    
    // Plan next action, passing credentials down to planner
    const plan = await planNextStep(history, userQuestion, steps, provider, model, apiKey);
    
    console.log(`[Agent Execution] Thought: "${plan.thought}"`);
    console.log(`[Agent Execution] Action: tool="${plan.tool}", args=`, plan.args);

    if (plan.tool === "final_answer") {
      responseMessage = plan.args.message || "I have analyzed the system but have no further comments.";
      
      // Save current turn to database
      await saveMessage(sessionId, "user", userQuestion);
      await saveMessage(sessionId, "assistant", responseMessage);
      
      return {
        response: responseMessage,
        steps,
      };
    }

    // Execute selected tool
    let observation: any;
    try {
      observation = await executeTool(plan.tool, plan.args);
    } catch (err: any) {
      console.warn(`[Agent Execution] Tool "${plan.tool}" failed: ${err.message}`);
      observation = { error: err.message };
    }

    // Record the step
    steps.push({
      thought: plan.thought,
      tool: plan.tool,
      args: plan.args,
      observation,
    });
  }

  // If maxSteps is reached without final_answer, return what we have
  responseMessage = 
    `I performed several scans but was unable to complete the analysis within the execution limit. ` +
    `Here is what I investigated:\n\n` +
    steps.map((s, idx) => `**Step ${idx + 1}:** Thought: *${s.thought}* (Tool: ${s.tool})`).join("\n");

  await saveMessage(sessionId, "user", userQuestion);
  await saveMessage(sessionId, "assistant", responseMessage);

  return {
    response: responseMessage,
    steps,
  };
}
