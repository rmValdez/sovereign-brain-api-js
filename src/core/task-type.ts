/**
 * Task categories produced by the brain classifier and consumed by model routing.
 * Lives in core so infrastructure (ollama/router.ts) does not depend on modules/brain.
 */
export enum TaskType {
  CONVERSATION = "conversation",
  QUESTION = "question",
  CODING = "coding",
  DEBUGGING = "debugging",
  TOOL_OPERATION = "tool_operation",
  COMPLEX_TASK = "complex_task",
}
