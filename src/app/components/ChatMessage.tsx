"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SubAgentIndicator } from "@/app/components/SubAgentIndicator";
import { ToolCallBox } from "@/app/components/ToolCallBox";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import type {
  SubAgent,
  ToolCall,
  ActionRequest,
  ReviewConfig,
} from "@/app/types/types";
import { Message } from "@langchain/langgraph-sdk";
import {
  extractSubAgentContent,
  extractStringFromMessageContent,
} from "@/app/utils/utils";
import { cn } from "@/lib/utils";
import { ToolApprovalInterrupt } from "@/app/components/ToolApprovalInterrupt";

interface ChatMessageProps {
  message: Message;
  toolCalls: ToolCall[];
  isLoading?: boolean;
  actionRequestsMap?: Map<string, ActionRequest>;
  reviewConfigsMap?: Map<string, ReviewConfig>;
  ui?: any[];
  stream?: any;
  onResumeInterrupt?: (value: any) => void;
  graphId?: string;
  subagentMessages?: Map<string, any[]>;
}

export const ChatMessage = React.memo<ChatMessageProps>(
  ({
    message,
    toolCalls,
    isLoading,
    actionRequestsMap,
    reviewConfigsMap,
    ui,
    stream,
    onResumeInterrupt,
    graphId,
    subagentMessages,
  }) => {
    const isUser = message.type === "human";
    const messageContent = extractStringFromMessageContent(message);
    const hasContent = messageContent && messageContent.trim() !== "";
    const hasToolCalls = toolCalls.length > 0;
    const subAgents = useMemo(() => {
      return toolCalls
        .filter((toolCall: ToolCall) => {
          return (
            toolCall.name === "task" &&
            toolCall.args["subagent_type"] &&
            toolCall.args["subagent_type"] !== "" &&
            toolCall.args["subagent_type"] !== null
          );
        })
        .map((toolCall: ToolCall) => {
          const subagentType = (toolCall.args as Record<string, unknown>)[
            "subagent_type"
          ] as string;
          return {
            id: toolCall.id,
            name: toolCall.name,
            subAgentName: subagentType,
            input: toolCall.args,
            output: toolCall.result ? { result: toolCall.result } : undefined,
            status: toolCall.status,
          } as SubAgent;
        });
    }, [toolCalls]);

    const [expandedSubAgents, setExpandedSubAgents] = useState<
      Record<string, boolean>
    >({});
    const isSubAgentExpanded = useCallback(
      (id: string) => expandedSubAgents[id] ?? true,
      [expandedSubAgents]
    );
    const toggleSubAgent = useCallback((id: string) => {
      setExpandedSubAgents((prev) => ({
        ...prev,
        [id]: prev[id] === undefined ? false : !prev[id],
      }));
    }, []);

    return (
      <div
        className={cn(
          "flex w-full max-w-full overflow-x-hidden",
          isUser && "flex-row-reverse"
        )}
      >
        <div
          className={cn(
            "min-w-0 max-w-full",
            isUser ? "max-w-[70%]" : "w-full"
          )}
        >
          {hasContent && (
            <div className={cn("relative flex items-end gap-0")}>
              <div
                className={cn(
                  "mt-4 overflow-hidden break-words text-sm font-normal leading-[150%]",
                  isUser
                    ? "rounded-xl rounded-br-none border border-border px-3 py-2 text-foreground"
                    : "text-primary"
                )}
                style={
                  isUser
                    ? { backgroundColor: "var(--color-user-message-bg)" }
                    : undefined
                }
              >
                {isUser ? (
                  <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {messageContent}
                  </p>
                ) : hasContent ? (
                  <MarkdownContent content={messageContent} />
                ) : null}
              </div>
            </div>
          )}
          {hasToolCalls && (
            <div className="mt-4 flex w-full flex-col">
              {toolCalls.map((toolCall: ToolCall) => {
                if (toolCall.name === "task") return null;
                const toolCallGenUiComponent = ui?.find(
                  (u) => u.metadata?.tool_call_id === toolCall.id
                );
                const actionRequest = actionRequestsMap?.get(toolCall.name);
                const reviewConfig = reviewConfigsMap?.get(toolCall.name);
                return (
                  <ToolCallBox
                    key={toolCall.id}
                    toolCall={toolCall}
                    uiComponent={toolCallGenUiComponent}
                    stream={stream}
                    graphId={graphId}
                    actionRequest={actionRequest}
                    reviewConfig={reviewConfig}
                    onResume={onResumeInterrupt}
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}
          {!isUser && subAgents.length > 0 && (
            <div className="flex w-full max-w-full flex-col gap-4">
              {subAgents.map((subAgent) => (
                <div
                  key={subAgent.id}
                  className="ml-4 flex w-full flex-col gap-2 border-l-2 border-blue-400/50 pl-4"
                >
                  <div className="flex items-end gap-2">
                    <div className="w-full">
                      <SubAgentIndicator
                        subAgent={subAgent}
                        onClick={() => toggleSubAgent(subAgent.id)}
                        isExpanded={isSubAgentExpanded(subAgent.id)}
                      />
                    </div>
                  </div>
                  {/* Show permission request if this subagent (task tool call) has one */}
                  {actionRequestsMap?.get(subAgent.name) && onResumeInterrupt && (
                    <div className="mt-2 w-full max-w-full">
                      <ToolApprovalInterrupt
                        actionRequest={actionRequestsMap.get(subAgent.name)!}
                        reviewConfig={reviewConfigsMap?.get(subAgent.name)}
                        onResume={onResumeInterrupt}
                        isLoading={isLoading}
                      />
                    </div>
                  )}
                  {isSubAgentExpanded(subAgent.id) && (
                    <div className="w-full max-w-full">
                      <div className="rounded-md border border-border bg-muted/30 p-4">
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Input
                        </h4>
                        <div className="mb-4">
                          <MarkdownContent
                            content={extractSubAgentContent(subAgent.input)}
                          />
                        </div>

                        {/* Show subagent streaming messages (tool calls, AI content, etc.) */}
                        {(() => {
                          // Workaround: namespace IDs don't match tool call IDs, so we can't directly match.
                          // Instead, aggregate all subagent messages. In most cases there's only one active subagent.
                          const allSubagentMsgs = subagentMessages
                            ? Array.from(subagentMessages.values()).flat()
                            : [];

                          if (allSubagentMsgs.length === 0) return null;

                          // Build a map of tool call ID -> tool result for matching
                          const toolResults = new Map<string, any>();
                          allSubagentMsgs.forEach((msg: any) => {
                            if (msg.type === "tool" && msg.tool_call_id) {
                              toolResults.set(msg.tool_call_id, msg);
                            }
                          });

                          // Extract tool calls from AI messages and format them for ToolCallBox
                          const subagentToolCalls: ToolCall[] = [];
                          allSubagentMsgs.forEach((msg: any) => {
                            if (msg.type === "ai" && msg.tool_calls && Array.isArray(msg.tool_calls)) {
                              msg.tool_calls.forEach((tc: any) => {
                                const toolResult = toolResults.get(tc.id);
                                // Extract result content - handle different formats
                                let resultContent: string | undefined;
                                if (toolResult) {
                                  const content = toolResult.content;
                                  if (typeof content === "string") {
                                    resultContent = content;
                                  } else if (Array.isArray(content)) {
                                    // Content can be array of text blocks
                                    resultContent = content
                                      .map((item: any) => typeof item === "string" ? item : item.text || JSON.stringify(item))
                                      .join("\n");
                                  } else if (content) {
                                    resultContent = JSON.stringify(content, null, 2);
                                  }
                                }
                                subagentToolCalls.push({
                                  id: tc.id,
                                  name: tc.name || "unknown",
                                  args: tc.args || {},
                                  status: toolResult ? "completed" : "pending",
                                  result: resultContent,
                                });
                              });
                            }
                          });

                          // Also get text content from AI messages
                          const aiTextContent = allSubagentMsgs
                            .filter((msg: any) => msg.type === "ai" && msg.content && typeof msg.content === "string" && msg.content.trim())
                            .map((msg: any) => msg.content.trim());

                          return (
                            <>
                              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Activity
                              </h4>
                              <div className="mb-4 space-y-2">
                                {/* AI text content */}
                                {aiTextContent.map((content: string, idx: number) => (
                                  <div key={`text-${idx}`} className="mb-2">
                                    <MarkdownContent content={content} />
                                  </div>
                                ))}
                                {/* Tool calls using ToolCallBox */}
                                {subagentToolCalls.map((toolCall) => (
                                  <ToolCallBox
                                    key={toolCall.id}
                                    toolCall={toolCall}
                                    stream={stream}
                                    graphId={graphId}
                                    isLoading={isLoading}
                                  />
                                ))}
                              </div>
                            </>
                          );
                        })()}

                        {subAgent.output && (
                          <>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Output
                            </h4>
                            <MarkdownContent
                              content={extractSubAgentContent(subAgent.output)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
