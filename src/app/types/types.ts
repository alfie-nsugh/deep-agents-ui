export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "completed" | "error" | "interrupted";
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "active" | "completed" | "error";
}

export interface FileItem {
  path: string;
  content: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  updatedAt?: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterruptData {
  value: any;
  ns?: string[];
  scope?: string;
}

export interface ActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ReviewConfig {
  actionName: string;
  allowedDecisions?: string[];
}

export interface ToolApprovalInterruptData {
  action_requests: ActionRequest[];
  review_configs?: ReviewConfig[];
}

// ============================================
// Question Types for HITL Questions Panel
// ============================================

export type QuestionPriority = "blocking" | "high" | "medium" | "nice_to_have";

export type QuestionStatus = "pending" | "answered" | "skipped";

export interface QuestionContext {
  file?: string;
  lineNumber?: number;
  branch?: string;
  skillLabels?: string[];
  sessionId?: string;
  stepIndex?: number;
}

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  text: string;
  priority: QuestionPriority;
  confidence: number; // 0.0 to 1.0
  status: QuestionStatus;
  context: QuestionContext;
  options?: QuestionOption[]; // For multiple choice questions
  answer?: string;
  answeredAt?: Date;
  createdAt: Date;
  subject?: string; // Auto-detected or agent-provided grouping
}

export interface QuestionGroup {
  subject: string;
  questions: Question[];
  count: number;
}

export interface QuestionsInterruptData {
  questions: Question[];
}
