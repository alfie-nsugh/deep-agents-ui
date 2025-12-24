"use client";

import { useState, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
    Question,
    QuestionPriority,
    QuestionContext,
    QuestionOption,
    QuestionsInterruptData,
} from "@/app/types/types";

interface UseQuestionsOptions {
    onAnswer?: (questionId: string, answer: string) => void;
    onResumeWithAnswers?: (answers: Record<string, string>) => void;
}

interface UseQuestionsReturn {
    questions: Question[];
    pendingQuestions: Question[];
    answeredQuestions: Question[];
    hasBlockingQuestions: boolean;
    pendingCount: number;
    blockingCount: number;

    // Actions
    addQuestion: (
        text: string,
        options?: {
            priority?: QuestionPriority;
            confidence?: number;
            context?: QuestionContext;
            options?: QuestionOption[];
            subject?: string;
        }
    ) => string;
    addQuestionsFromInterrupt: (data: QuestionsInterruptData) => void;
    answerQuestion: (questionId: string, answer: string) => void;
    skipQuestion: (questionId: string) => void;
    clearAnswered: () => void;
    reset: () => void;

    // Utilities
    getUnansweredBlockingQuestions: () => Question[];
    getAllAnswers: () => Record<string, string>;
    canProceed: () => boolean;
}

export function useQuestions(options: UseQuestionsOptions = {}): UseQuestionsReturn {
    const { onAnswer, onResumeWithAnswers } = options;
    const [questions, setQuestions] = useState<Question[]>([]);

    // Derived state
    const pendingQuestions = useMemo(
        () => questions.filter((q) => q.status === "pending"),
        [questions]
    );

    const answeredQuestions = useMemo(
        () => questions.filter((q) => q.status === "answered" || q.status === "skipped"),
        [questions]
    );

    const hasBlockingQuestions = useMemo(
        () => pendingQuestions.some((q) => q.priority === "blocking"),
        [pendingQuestions]
    );

    const blockingCount = useMemo(
        () => pendingQuestions.filter((q) => q.priority === "blocking").length,
        [pendingQuestions]
    );

    // Add a single question
    const addQuestion = useCallback(
        (
            text: string,
            opts?: {
                priority?: QuestionPriority;
                confidence?: number;
                context?: QuestionContext;
                options?: QuestionOption[];
                subject?: string;
            }
        ): string => {
            const id = uuidv4();
            const question: Question = {
                id,
                text,
                priority: opts?.priority || "medium",
                confidence: opts?.confidence ?? 0.5,
                status: "pending",
                context: opts?.context || {},
                options: opts?.options,
                subject: opts?.subject,
                createdAt: new Date(),
            };

            setQuestions((prev) => [...prev, question]);
            return id;
        },
        []
    );

    // Add questions from an interrupt payload
    const addQuestionsFromInterrupt = useCallback(
        (data: QuestionsInterruptData) => {
            if (!data.questions || !Array.isArray(data.questions)) return;

            const newQuestions: Question[] = data.questions.map((q) => ({
                id: q.id || uuidv4(),
                text: q.text,
                priority: q.priority || "medium",
                confidence: q.confidence ?? 0.5,
                status: "pending" as const,
                context: q.context || {},
                options: q.options,
                subject: q.subject,
                createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
            }));

            setQuestions((prev) => {
                // Filter out duplicates by ID
                const existingIds = new Set(prev.map((q) => q.id));
                const unique = newQuestions.filter((q) => !existingIds.has(q.id));
                return [...prev, ...unique];
            });
        },
        []
    );

    // Answer a question
    const answerQuestion = useCallback(
        (questionId: string, answer: string) => {
            setQuestions((prev) =>
                prev.map((q) =>
                    q.id === questionId
                        ? {
                            ...q,
                            status: "answered" as const,
                            answer,
                            answeredAt: new Date(),
                        }
                        : q
                )
            );

            onAnswer?.(questionId, answer);

            // Check if all blocking questions are answered
            setQuestions((prev) => {
                const stillBlocking = prev.filter(
                    (q) => q.priority === "blocking" && q.status === "pending"
                );

                if (stillBlocking.length === 0 && onResumeWithAnswers) {
                    // All blocking questions answered - can resume
                    const answers = prev
                        .filter((q) => q.status === "answered" && q.answer)
                        .reduce(
                            (acc, q) => ({
                                ...acc,
                                [q.id]: q.answer!,
                            }),
                            {} as Record<string, string>
                        );

                    // We'll call this outside the setState
                    setTimeout(() => onResumeWithAnswers(answers), 0);
                }

                return prev;
            });
        },
        [onAnswer, onResumeWithAnswers]
    );

    // Skip a question
    const skipQuestion = useCallback((questionId: string) => {
        setQuestions((prev) =>
            prev.map((q) =>
                q.id === questionId
                    ? {
                        ...q,
                        status: "skipped" as const,
                        answeredAt: new Date(),
                    }
                    : q
            )
        );
    }, []);

    // Clear answered/skipped questions
    const clearAnswered = useCallback(() => {
        setQuestions((prev) => prev.filter((q) => q.status === "pending"));
    }, []);

    // Reset all questions
    const reset = useCallback(() => {
        setQuestions([]);
    }, []);

    // Get unanswered blocking questions
    const getUnansweredBlockingQuestions = useCallback(() => {
        return questions.filter(
            (q) => q.priority === "blocking" && q.status === "pending"
        );
    }, [questions]);

    // Get all answers as a record
    const getAllAnswers = useCallback(() => {
        return questions
            .filter((q) => q.status === "answered" && q.answer)
            .reduce(
                (acc, q) => ({
                    ...acc,
                    [q.id]: q.answer!,
                }),
                {} as Record<string, string>
            );
    }, [questions]);

    // Check if we can proceed (no blocking questions pending)
    const canProceed = useCallback(() => {
        return !questions.some(
            (q) => q.priority === "blocking" && q.status === "pending"
        );
    }, [questions]);

    return {
        questions,
        pendingQuestions,
        answeredQuestions,
        hasBlockingQuestions,
        pendingCount: pendingQuestions.length,
        blockingCount,

        addQuestion,
        addQuestionsFromInterrupt,
        answerQuestion,
        skipQuestion,
        clearAnswered,
        reset,

        getUnansweredBlockingQuestions,
        getAllAnswers,
        canProceed,
    };
}
