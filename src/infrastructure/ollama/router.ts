import { config } from "../../core/config.js";
import { TaskType } from "../../core/task-type.js";

/**
 * Task-to-model routing matching Python's app/infrastructure/ollama/router.py:
 * - CODING / DEBUGGING -> codingModel (qwen3:8b)
 * - COMPLEX_TASK -> plannerModel (hermes3:8b)
 * - TOOL_OPERATION, QUESTION, CONVERSATION -> defaultChatModel (qwen3:8b)
 */
export function selectModel(taskType: TaskType): string {
  if (taskType === TaskType.CODING || taskType === TaskType.DEBUGGING) {
    return config.ollama.codingModel;
  }
  if (taskType === TaskType.COMPLEX_TASK) {
    return config.ollama.plannerModel;
  }
  // All other task types (including TOOL_OPERATION) use general/default chat model
  return config.ollama.defaultChatModel;
}
