import { afterEach, describe, expect, it } from "vitest";
import { config } from "../src/core/config.js";
import { selectModel } from "../src/infrastructure/ollama/router.js";
import { TaskType } from "../src/modules/brain/classifier.js";

describe("Model router (selectModel - Python test_model_router.py parity)", () => {
  const originalCodingModel = config.ollama.codingModel;
  const originalPlannerModel = config.ollama.plannerModel;
  const originalDefaultModel = config.ollama.defaultChatModel;

  afterEach(() => {
    config.ollama.codingModel = originalCodingModel;
    config.ollama.plannerModel = originalPlannerModel;
    config.ollama.defaultChatModel = originalDefaultModel;
  });

  it("routes CONVERSATION and QUESTION to the general model", () => {
    expect(selectModel(TaskType.CONVERSATION)).toBe(config.ollama.defaultChatModel);
    expect(selectModel(TaskType.QUESTION)).toBe(config.ollama.defaultChatModel);
  });

  it("routes TOOL_OPERATION to the general model", () => {
    expect(selectModel(TaskType.TOOL_OPERATION)).toBe(config.ollama.defaultChatModel);
  });

  it("routes CODING and DEBUGGING to the coding model", () => {
    expect(selectModel(TaskType.CODING)).toBe(config.ollama.codingModel);
    expect(selectModel(TaskType.DEBUGGING)).toBe(config.ollama.codingModel);
  });

  it("routes COMPLEX_TASK to the planner model", () => {
    expect(selectModel(TaskType.COMPLEX_TASK)).toBe(config.ollama.plannerModel);
  });

  it("reads config live at call time, not at import time", () => {
    config.ollama.codingModel = "custom-coder-model:latest";
    expect(selectModel(TaskType.CODING)).toBe("custom-coder-model:latest");

    config.ollama.plannerModel = "custom-planner-model:latest";
    expect(selectModel(TaskType.COMPLEX_TASK)).toBe("custom-planner-model:latest");

    config.ollama.defaultChatModel = "custom-general-model:latest";
    expect(selectModel(TaskType.CONVERSATION)).toBe("custom-general-model:latest");
  });
});
