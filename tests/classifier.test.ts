import { describe, it, expect } from "vitest";
import { TaskType, classifyTask, classifyTaskExplained } from "../src/modules/brain/classifier.js";

describe("Python Parity: test_classifier.py word-for-word port", () => {
  it("test_classify_plain_question", () => {
    expect(classifyTask("What is Docker?")).toBe(TaskType.QUESTION);
  });

  it("test_classify_single_write_file_stays_tool_operation", () => {
    // Regression guard: must NOT be COMPLEX_TASK, or it would break the
    // existing single-tool confirmation-required path.
    expect(classifyTask("write file report.txt")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_single_calculate_stays_tool_operation", () => {
    expect(classifyTask("calculate 2+2")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_directory_creation_is_tool_operation", () => {
    // Regression test: live-verified this fell through to CONVERSATION
    // (no tool awareness at all, model just described a shell command)
    // before _DIRECTORY_OPS existed - _FILE_OPS had no directory keywords.
    expect(classifyTask("create a directory called live_check_dir")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_list_files_phrasing_is_tool_operation", () => {
    // Regression test: live-verified this fell through to a direct answer
    // describing `ls`/`dir` shell commands - the old "list director"
    // phrase didn't match "list files in the current directory" at all.
    expect(classifyTask("list files in the current directory")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_current_time_request_is_tool_operation", () => {
    // Regression test: live-verified this fell through to QUESTION (no
    // tool group matched _TOOL_GROUPS at all before _TIME_OPS existed),
    // hallucinating "I cannot access real-time data" instead of calling
    // current_time.
    expect(classifyTask("what time is it right now")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_multi_step_request_is_complex", () => {
    const message = "Read config.json, then check git status, then calculate how many lines it has";
    expect(classifyTask(message)).toBe(TaskType.COMPLEX_TASK);
  });

  it("test_classify_single_group_with_sequence_marker_is_complex", () => {
    expect(classifyTask("first, write file notes.txt")).toBe(TaskType.COMPLEX_TASK);
  });

  it("test_classify_debugging_message", () => {
    expect(classifyTask("I got a traceback: KeyError in main.py, fix this bug")).toBe(TaskType.DEBUGGING);
  });

  it("test_classify_coding_message", () => {
    expect(classifyTask("implement a function that reverses a string")).toBe(TaskType.CODING);
  });

  it("test_classify_conversation_fallback", () => {
    expect(classifyTask("hey how's it going")).toBe(TaskType.CONVERSATION);
  });

  it("test_classify_freshness_phrasing_is_tool_operation", () => {
    // Phase 2A regression guard: "find the latest news about X" matches no
    // _TOOL_GROUPS keyword at all (no "search for"/"web search" phrasing),
    // so before freshness detection this fell all the way through to
    // CONVERSATION - answered from training data with zero tool awareness.
    expect(classifyTask("find the latest news about the election")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_freshness_phrasing_without_web_keyword_is_tool_operation", () => {
    expect(classifyTask("what's the latest React version")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_check_web_phrasing_is_tool_operation", () => {
    // Regression test (FUTURE_ROADMAP.md §6.13's "demonstrated gap"):
    // live-verified a real message ending in "check web" classified as
    // CONVERSATION - no _WEB_OPS phrase matched "check web" at all, so the
    // request went straight to a direct, ungrounded answer instead of
    // AgentLoop/web_search.
    expect(classifyTask("therree is ongoping war of iran with us check web")).toBe(TaskType.TOOL_OPERATION);
    expect(classifyTask("is the war still ongoing? check web")).toBe(TaskType.TOOL_OPERATION);
    expect(classifyTask("can you verify this online")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_conceptual_question_without_freshness_stays_question", () => {
    // Must NOT be swept into TOOL_OPERATION just because it mentions a
    // topic that could be time-sensitive - only actual freshness phrasing
    // ("latest", "today", "recent", ...) should trigger this.
    expect(classifyTask("How does PostgreSQL indexing work?")).toBe(TaskType.QUESTION);
  });

  it("test_classify_search_again_is_tool_operation", () => {
    // Phase 2A regression guard: "search again" has no query of its own
    // and matches no _WEB_OPS phrase ("search the web"/"web search"/...),
    // so before continuation detection this fell through to a plain answer
    // that just re-described the previous result instead of searching again.
    expect(classifyTask("search again and see if there is anything newer")).toBe(TaskType.TOOL_OPERATION);
  });

  it("test_classify_task_explained_returns_signals", () => {
    const [taskType, signals] = classifyTaskExplained("What is Docker?");
    expect(taskType).toBe(TaskType.QUESTION);
    expect(signals.matched_tool_groups_count).toBe(0);
    expect(signals.reason).toContain("interrogative");

    const [taskTypeTool, signalsTool] = classifyTaskExplained("write file test.txt");
    expect(taskTypeTool).toBe(TaskType.TOOL_OPERATION);
    expect(signalsTool.matched_tool_groups_count).toBe(1);
    expect(signalsTool.reason).toContain("single tool group");

    const [taskTypeComplex, signalsComplex] = classifyTaskExplained("write file test.txt then run git status");
    expect(taskTypeComplex).toBe(TaskType.COMPLEX_TASK);
    expect(signalsComplex.matched_tool_groups_count).toBeGreaterThanOrEqual(2);
    expect(signalsComplex.reason).toContain("multiple tool groups");
  });
});
