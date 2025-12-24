"use client";

import React, { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "./QuestionCard";
import type { Question, QuestionGroup } from "@/app/types/types";
import {
    MessageCircleQuestion,
    ChevronRight,
    X,
} from "lucide-react";

interface QuestionsPanelProps {
    questions: Question[];
    onAnswer: (questionId: string, answer: string) => void;
    onSkip: (questionId: string) => void;
    onViewTrace?: (questionId: string) => void;
    onOpenDashboard?: () => void;
    onDismiss?: () => void;
    className?: string;
}

// Detect subject from question context
function detectSubject(question: Question): string {
    // 1. Use agent-provided subject if available
    if (question.subject) {
        return question.subject;
    }

    // 2. Check file path patterns
    const filePath = question.context.file?.toLowerCase() || "";
    if (filePath.includes("api") || filePath.includes("client")) {
        return "API Design";
    }
    if (filePath.includes("test")) {
        return "Testing Strategy";
    }
    if (filePath.includes("perf") || filePath.includes("cache")) {
        return "Performance";
    }
    if (filePath.includes("auth") || filePath.includes("login")) {
        return "Authentication";
    }
    if (filePath.includes("component") || filePath.includes("ui")) {
        return "UI Components";
    }
    if (filePath.includes("model") || filePath.includes("schema")) {
        return "Data Model";
    }

    // 3. Check question keywords
    const text = question.text.toLowerCase();
    if (
        text.includes("api") ||
        text.includes("endpoint") ||
        text.includes("rest") ||
        text.includes("graphql")
    ) {
        return "API Design";
    }
    if (
        text.includes("test") ||
        text.includes("mock") ||
        text.includes("coverage")
    ) {
        return "Testing Strategy";
    }
    if (
        text.includes("performance") ||
        text.includes("optimize") ||
        text.includes("cache")
    ) {
        return "Performance";
    }

    // 4. Use skill labels if available
    if (question.context.skillLabels && question.context.skillLabels.length > 0) {
        return question.context.skillLabels[0]
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    return "General";
}

// Group questions by subject
function groupQuestions(questions: Question[]): QuestionGroup[] {
    const groups: Map<string, Question[]> = new Map();

    questions.forEach((q) => {
        const subject = detectSubject(q);
        const existing = groups.get(subject) || [];
        groups.set(subject, [...existing, q]);
    });

    return Array.from(groups.entries())
        .map(([subject, questions]) => ({
            subject,
            questions,
            count: questions.length,
        }))
        .sort((a, b) => {
            // Prioritize groups with blocking questions
            const aBlocking = a.questions.some((q) => q.priority === "blocking");
            const bBlocking = b.questions.some((q) => q.priority === "blocking");
            if (aBlocking && !bBlocking) return -1;
            if (!aBlocking && bBlocking) return 1;
            return b.count - a.count;
        });
}

export const QuestionsPanel = React.memo<QuestionsPanelProps>(
    ({
        questions,
        onAnswer,
        onSkip,
        onViewTrace,
        onOpenDashboard,
        onDismiss,
        className,
    }) => {
        // Filter to only pending questions
        const pendingQuestions = useMemo(
            () => questions.filter((q) => q.status === "pending"),
            [questions]
        );

        // Get the current (most urgent) question
        const currentQuestion = useMemo(() => {
            if (pendingQuestions.length === 0) return null;

            // Sort by priority, then by confidence (lower confidence = more urgent)
            const sorted = [...pendingQuestions].sort((a, b) => {
                const priorityOrder = { blocking: 0, high: 1, medium: 2, nice_to_have: 3 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return a.confidence - b.confidence;
            });

            return sorted[0];
        }, [pendingQuestions]);

        // Group remaining questions
        const groupedQuestions = useMemo(
            () => groupQuestions(pendingQuestions.filter((q) => q.id !== currentQuestion?.id)),
            [pendingQuestions, currentQuestion]
        );

        const totalPending = pendingQuestions.length;
        const blockingCount = pendingQuestions.filter(
            (q) => q.priority === "blocking"
        ).length;

        const handleAnswer = useCallback(
            (questionId: string, answer: string) => {
                onAnswer(questionId, answer);
            },
            [onAnswer]
        );

        const handleSkip = useCallback(
            (questionId: string) => {
                onSkip(questionId);
            },
            [onSkip]
        );

        // Don't render if no pending questions
        if (totalPending === 0) {
            return null;
        }

        return (
            <div
                className={cn(
                    "rounded-lg border border-orange-200 bg-orange-50/30 dark:border-orange-900/50 dark:bg-orange-950/10",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-orange-200/50 px-4 py-3 dark:border-orange-900/30">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <MessageCircleQuestion
                                size={20}
                                className="text-orange-600 dark:text-orange-400"
                            />
                            {blockingCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
                                    <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Agent needs your input
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {totalPending} question{totalPending !== 1 ? "s" : ""} pending
                                {blockingCount > 0 && (
                                    <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                                        ({blockingCount} blocking)
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {onOpenDashboard && totalPending > 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onOpenDashboard}
                                className="text-xs"
                            >
                                View all
                                <ChevronRight size={14} className="ml-1" />
                            </Button>
                        )}
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="rounded-md p-1 text-muted-foreground hover:bg-orange-100 hover:text-foreground dark:hover:bg-orange-900/30"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Current Question */}
                {currentQuestion && (
                    <div className="p-4">
                        <QuestionCard
                            question={currentQuestion}
                            onAnswer={handleAnswer}
                            onSkip={handleSkip}
                            onViewTrace={onViewTrace}
                        />
                    </div>
                )}

                {/* Queue Preview */}
                {groupedQuestions.length > 0 && (
                    <div className="border-t border-orange-200/50 px-4 py-3 dark:border-orange-900/30">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                Up next:
                            </span>
                            {groupedQuestions.slice(0, 3).map((group) => (
                                <span
                                    key={group.subject}
                                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                >
                                    {group.subject}
                                    <span className="font-medium">({group.count})</span>
                                </span>
                            ))}
                            {groupedQuestions.length > 3 && (
                                <button
                                    onClick={onOpenDashboard}
                                    className="text-xs text-primary hover:underline"
                                >
                                    +{groupedQuestions.length - 3} more
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

QuestionsPanel.displayName = "QuestionsPanel";
