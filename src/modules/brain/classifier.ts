import { TaskType } from "../../core/task-type.js";
import { requiresFreshData, isSearchContinuation } from "./freshness.js";

export { TaskType };

const FILE_OPS = ["write file", "save file", "create file", "read file", "delete file"];
const DIRECTORY_OPS = [
  "create a directory",
  "create directory",
  "create a folder",
  "create folder",
  "make a directory",
  "make directory",
  "make a folder",
  "make folder",
  "list director",
  "list files in",
  "list files",
];
const GIT_OPS = [
  "git status",
  "git log",
  "git diff",
  "git commit",
  "git push",
  "commit this",
  "push this",
];
const CALC_OPS = ["calculate", "compute "];
const WEB_OPS = [
  "search the web",
  "web search",
  "look up online",
  "search for",
  "check web",
  "check online",
  "check the web",
  "verify online",
  "verify this online",
  "look this up",
  "browse for",
];
const TIME_OPS = [
  "what time is it",
  "current time",
  "current date",
  "today's date",
  "what is the date",
  "what's the date",
  "what day is it",
  "tell me the time",
];

const TOOL_GROUPS = [FILE_OPS, DIRECTORY_OPS, GIT_OPS, CALC_OPS, WEB_OPS, TIME_OPS];

const SEQUENCE_MARKERS = [
  " then ",
  "first,",
  "first ,",
  "step 1",
  "after that",
  "multi-step",
  "multistep",
  "step by step",
  " and then",
  "followed by",
];

const DEBUGGING_KEYWORDS = [
  "error",
  "exception",
  "traceback",
  "not working",
  "isn't working",
  "doesn't work",
  "fix this",
  "fix the",
  "bug",
  "broken",
  "fails",
  "failing",
];

const CODING_KEYWORDS = [
  "implement",
  "refactor",
  "write a function",
  "add a feature",
  "```",
  "def ",
  "class ",
  "function that",
];

const QUESTION_PREFIXES = [
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "which",
  "is ",
  "are ",
  "can ",
  "does ",
  "do ",
  "should ",
  "would ",
];

export interface ClassificationSignals {
  matched_tool_groups_count: number;
  has_sequence_marker: boolean;
  is_evaluation_goal: boolean;
  requires_fresh_data?: boolean;
  is_search_continuation?: boolean;
  reason: string;
}

export function classifyTaskExplained(message: string): [TaskType, ClassificationSignals] {
  const lower = message.toLowerCase();

  const matchedGroups = TOOL_GROUPS.reduce((count, group) => {
    return count + (group.some((kw) => lower.includes(kw)) ? 1 : 0);
  }, 0);

  const hasSeq = SEQUENCE_MARKERS.some((marker) => lower.includes(marker));
  const isEval = lower.includes("architectural decision") || lower.includes("evaluation goal");

  const signals: ClassificationSignals = {
    matched_tool_groups_count: matchedGroups,
    has_sequence_marker: hasSeq,
    is_evaluation_goal: isEval,
    reason: "",
  };

  if (matchedGroups >= 2) {
    signals.reason = `multiple tool groups matched (${matchedGroups})`;
    return [TaskType.COMPLEX_TASK, signals];
  }
  if (matchedGroups === 1 && hasSeq) {
    signals.reason = "tool group with sequence marker";
    return [TaskType.COMPLEX_TASK, signals];
  }
  if (isEval) {
    signals.reason = "architectural evaluation or decision goal detected";
    return [TaskType.COMPLEX_TASK, signals];
  }

  const matchedDebug = DEBUGGING_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedDebug.length > 0) {
    signals.reason = `debugging keywords matched: ${matchedDebug.slice(0, 3).join(", ")}`;
    return [TaskType.DEBUGGING, signals];
  }

  const fresh = requiresFreshData(lower);
  const cont = isSearchContinuation(lower);
  signals.requires_fresh_data = fresh;
  signals.is_search_continuation = cont;

  if (matchedGroups === 1) {
    signals.reason = "single tool group matched";
    return [TaskType.TOOL_OPERATION, signals];
  }
  if (fresh) {
    signals.reason = "freshness required (web lookup signal)";
    return [TaskType.TOOL_OPERATION, signals];
  }
  if (cont) {
    signals.reason = "search continuation signal";
    return [TaskType.TOOL_OPERATION, signals];
  }

  const matchedCode = CODING_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedCode.length > 0) {
    signals.reason = `coding keywords matched: ${matchedCode.slice(0, 3).join(", ")}`;
    return [TaskType.CODING, signals];
  }

  const stripped = lower.trim();
  const isQ = stripped.endsWith("?") || QUESTION_PREFIXES.some((p) => stripped.startsWith(p));
  if (isQ) {
    signals.reason = "interrogative structure detected";
    return [TaskType.QUESTION, signals];
  }

  signals.reason = "general conversational input";
  return [TaskType.CONVERSATION, signals];
}

export function classifyTask(message: string): TaskType {
  const [taskType] = classifyTaskExplained(message);
  return taskType;
}
