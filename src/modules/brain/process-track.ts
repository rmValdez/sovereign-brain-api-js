import { randomUUID } from "crypto";

export enum ProcessStage {
  PROMPT = "prompt",
  CLASSIFIER = "classifier",
  ROUTING = "routing",
  PLANNER = "planner",
  TOOL_COMPATIBILITY = "tool_compatibility",
  TOOL_GATE = "tool_gate",
  TOOL_EXECUTION = "tool_execution",
  RECOVERY = "recovery",
  SYNTHESIS = "synthesis",
  FINAL_RESPONSE = "final_response",
}

export enum ProcessStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
  BLOCKED = "BLOCKED",
  RUNNING = "RUNNING",
}

export interface ProcessEvent {
  id: string;
  stage: ProcessStage;
  status: ProcessStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export interface ProcessTrack {
  trace_id: string;
  session_id: string;
  origin: string;
  prompt: string;
  message_id?: string;
  status: ProcessStatus;
  started_at: string;
  completed_at?: string;
  events: ProcessEvent[];
}

export class ProcessRecorder {
  public track: ProcessTrack;

  constructor(origin: string, sessionId: string, prompt: string) {
    this.track = {
      trace_id: randomUUID(),
      session_id: sessionId,
      origin,
      prompt,
      status: ProcessStatus.RUNNING,
      started_at: new Date().toISOString(),
      events: [],
    };
  }

  record(
    stage: ProcessStage,
    status: ProcessStatus,
    data: { input?: Record<string, unknown>; output?: Record<string, unknown>; error?: string } = {},
  ): void {
    this.track.events.push({
      id: randomUUID(),
      stage,
      status,
      input: data.input,
      output: data.output,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error: data.error,
    });
  }

  finish(status: ProcessStatus = ProcessStatus.SUCCESS): ProcessTrack {
    this.track.status = status;
    this.track.completed_at = new Date().toISOString();
    return this.track;
  }
}
