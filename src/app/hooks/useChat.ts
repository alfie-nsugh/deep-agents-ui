"use client";

import { useCallback, useRef } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();

  // Track message IDs that come from subagents, keyed by threadId
  const subagentMessageIdsByThread = useRef<Map<string, Set<string>>>(new Map());

  // Store subagent messages keyed by threadId -> toolCallId -> messages
  // This persists across thread switches during the session
  const subagentMessagesByThread = useRef<Map<string, Map<string, any[]>>>(new Map());

  // Get current thread's subagent data
  const currentThreadId = threadId ?? "__new__";

  // Initialize data structures for current thread if needed
  if (!subagentMessageIdsByThread.current.has(currentThreadId)) {
    subagentMessageIdsByThread.current.set(currentThreadId, new Set());
  }
  if (!subagentMessagesByThread.current.has(currentThreadId)) {
    subagentMessagesByThread.current.set(currentThreadId, new Map());
  }

  // These refs point to current thread's data for easy access
  const subagentMessageIds = { current: subagentMessageIdsByThread.current.get(currentThreadId)! };
  const subagentMessages = { current: subagentMessagesByThread.current.get(currentThreadId)! };

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: setThreadId,
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    fetchStateHistory: true, // Required for history feature
    // Revalidate thread list when stream finishes, errors, or creates new thread
    onFinish: onHistoryRevalidate,
    onError: onHistoryRevalidate,
    onCreated: onHistoryRevalidate,
    thread: thread,
    // Track subagent messages by extracting IDs from streaming events with namespace
    onUpdateEvent: (data, options) => {
      if (options.namespace && options.namespace.length > 0) {
        // Extract tool call ID from namespace (format: "tools:{tool_call_id}")
        const namespaceStr = options.namespace[0];
        const toolCallIdMatch = namespaceStr.match(/^tools:(.+)$/);
        const toolCallId = toolCallIdMatch ? toolCallIdMatch[1] : namespaceStr;

        // Extract messages from update data
        // The data structure can be data.model.messages or data.messages depending on the event
        const updateData = data as Record<string, any>;
        const messages = updateData.model?.messages || updateData.messages;
        if (messages && Array.isArray(messages)) {
          messages.forEach((msg: any, idx: number) => {
            // Generate a fallback ID for messages without one
            const msgId = msg.id || `${toolCallId}-msg-${idx}-${Date.now()}`;

            subagentMessageIds.current.add(msgId);

            // Store the full message for display, keyed by tool call ID
            if (!subagentMessages.current.has(toolCallId)) {
              subagentMessages.current.set(toolCallId, []);
            }
            // Only add if not already present (avoid duplicates)
            const existing = subagentMessages.current.get(toolCallId)!;
            if (!existing.find((m: any) => m.id === msgId)) {
              // Ensure the message has an id for later lookup
              const msgWithId = { ...msg, id: msgId };
              existing.push(msgWithId);
            }

            console.log("[SUBAGENT] Tracked message:", {
              toolCallId,
              messageId: msgId,
              type: msg.type,
              hasContent: !!msg.content,
              hasToolCallId: !!msg.tool_call_id, // This is for tool result messages
              toolCallIdValue: msg.tool_call_id,
            });
          });
        }
        console.log("[SUBAGENT UPDATE]", {
          namespace: options.namespace,
          toolCallId,
          messageCount: subagentMessages.current.get(toolCallId)?.length || 0,
          messageTypes: subagentMessages.current.get(toolCallId)?.map((m: any) => m.type) || [],
        });
      }
    },
    onDebugEvent: (data, options) => {
      if (options.namespace && options.namespace.length > 0) {
        const namespaceStr = options.namespace[0];
        const toolCallIdMatch = namespaceStr.match(/^tools:(.+)$/);
        const toolCallId = toolCallIdMatch ? toolCallIdMatch[1] : namespaceStr;

        const debugData = data as Record<string, any>;

        // Log all debug events to understand the structure
        console.log("[SUBAGENT DEBUG EVENT]", {
          type: debugData.type,
          namespace: options.namespace,
          payloadType: debugData.payload?.type,
          hasMessages: !!debugData.payload?.messages,
          hasContent: !!debugData.payload?.content,
          keys: Object.keys(debugData.payload || {}),
          fullPayload: debugData.payload, // Log full payload
          result: debugData.payload?.result, // Check for result field directly
        });

        // Try to capture messages from various locations in the payload
        // Messages can be at payload.messages, payload.input.messages, or payload directly
        const messageSources = [
          debugData.payload?.messages,
          debugData.payload?.input?.messages, // Tool results are often here
        ].filter(Boolean);

        for (const messages of messageSources) {
          if (Array.isArray(messages)) {
            messages.forEach((msg: any, idx: number) => {
              const msgId = msg.id || `debug-${toolCallId}-msg-${idx}-${Date.now()}`;
              subagentMessageIds.current.add(msgId);

              if (!subagentMessages.current.has(toolCallId)) {
                subagentMessages.current.set(toolCallId, []);
              }
              const existing = subagentMessages.current.get(toolCallId)!;
              if (!existing.find((m: any) => m.id === msgId)) {
                existing.push({ ...msg, id: msgId });
                console.log("[SUBAGENT DEBUG] Captured message:", { type: msg.type, name: msg.name, id: msgId });
              }
            });
          }
        }

        // Also check if the payload itself is a message (type = "tool")
        if (debugData.payload?.type === "tool") {
          const msg = debugData.payload;
          const msgId = msg.id || `debug-tool-${Date.now()}`;
          subagentMessageIds.current.add(msgId);

          if (!subagentMessages.current.has(toolCallId)) {
            subagentMessages.current.set(toolCallId, []);
          }
          const existing = subagentMessages.current.get(toolCallId)!;
          if (!existing.find((m: any) => m.id === msgId)) {
            existing.push({ ...msg, id: msgId });
            console.log("[SUBAGENT DEBUG] Captured tool message directly:", { id: msgId, toolCallId: msg.tool_call_id });
          }
        }
      }
    },
  });

  const sendMessage = useCallback(
    (content: string) => {
      const newMessage: Message = { id: uuidv4(), type: "human", content };
      stream.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), newMessage],
          }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
          streamSubgraphs: true,
        }
      );
      // Update thread list immediately when sending a message
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          streamSubgraphs: true,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"], streamSubgraphs: true }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      // TODO: missing a way how to revalidate the internal state
      // I think we do want to have the ability to externally manage the state
      await client.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 100,
        },
        streamSubgraphs: true,
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value }, streamSubgraphs: true });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  return {
    stream,
    todos: stream.values.todos ?? [],
    files: stream.values.files ?? {},
    email: stream.values.email,
    ui: stream.values.ui,
    setFiles,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    subagentMessageIds, // Expose for filtering in ChatInterface
    subagentMessages, // Expose subagent messages for display in subagent cards
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
  };
}
