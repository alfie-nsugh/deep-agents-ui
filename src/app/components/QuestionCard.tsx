"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Question, QuestionPriority } from "@/app/types/types";
import {
    AlertCircle,
    MessageCircle,
    Clock,
    FileCode,
    ChevronDown,
    ChevronUp,
    Send,
    SkipForward,
    Check,
} from "lucide-react";

interface QuestionCardProps {
    question: Question;
    onAnswer: (questionId: string, answer: string) => void;
    onSkip: (questionId: string) => void;
    onViewTrace?: (questionId: string) => void;
    compact?: boolean;
}

// Confidence level color coding
const getConfidenceColor = (confidence: number): string => {
    if (confidence < 0.3) return "text-red-500";
    if (confidence < 0.5) return "text-orange-500";
    if (confidence < 0.7) return "text-yellow-500";
    return "text-green-500";
};

const getConfidenceBgColor = (confidence: number): string => {
    if (confidence < 0.3) return "bg-red-500";
    if (confidence < 0.5) return "bg-orange-500";
    if (confidence < 0.7) return "bg-yellow-500";
    return "bg-green-500";
};

// Priority badge configuration
const priorityConfig: Record<
    QuestionPriority,
    { icon: React.ReactNode; color: string; bgColor: string; label: string }
> = {
    blocking: {
        icon: <AlertCircle size={12} />,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        label: "Blocking",
    },
    high: {
        icon: <AlertCircle size={12} />,
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        label: "High",
    },
    medium: {
        icon: <Clock size={12} />,
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
        label: "Medium",
    },
    nice_to_have: {
        icon: <MessageCircle size={12} />,
        color: "text-gray-600 dark:text-gray-400",
        bgColor: "bg-gray-100 dark:bg-gray-800/50",
        label: "Nice to Have",
    },
};

export const QuestionCard = React.memo<QuestionCardProps>(
    ({ question, onAnswer, onSkip, onViewTrace, compact = false }) => {
        const [expanded, setExpanded] = useState(!compact);
        const [answerText, setAnswerText] = useState("");
        const [selectedOption, setSelectedOption] = useState<string | null>(null);

        const priority = priorityConfig[question.priority];
        const confidencePercent = Math.round(question.confidence * 100);

        const handleSubmitAnswer = useCallback(() => {
            const answer = question.options ? selectedOption : answerText;
            if (answer) {
                onAnswer(question.id, answer);
                setAnswerText("");
                setSelectedOption(null);
            }
        }, [question.id, question.options, selectedOption, answerText, onAnswer]);

        const handleSkip = useCallback(() => {
            onSkip(question.id);
        }, [question.id, onSkip]);

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitAnswer();
                }
            },
            [handleSubmitAnswer]
        );

        const isAnswered = question.status === "answered";
        const isSkipped = question.status === "skipped";

        return (
            <div
                className={cn(
                    "rounded-lg border transition-all duration-200",
                    question.priority === "blocking"
                        ? "border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20"
                        : "border-border bg-card",
                    isAnswered && "opacity-60",
                    isSkipped && "opacity-40"
                )}
            >
                {/* Header */}
                <div
                    className={cn(
                        "flex cursor-pointer items-center gap-3 p-4",
                        compact && "p-3"
                    )}
                    onClick={() => setExpanded(!expanded)}
                >
                    {/* Priority Badge */}
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            priority.bgColor,
                            priority.color
                        )}
                    >
                        {priority.icon}
                        {priority.label}
                    </span>

                    {/* Confidence Meter */}
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    getConfidenceBgColor(question.confidence)
                                )}
                                style={{ width: `${confidencePercent}%` }}
                            />
                        </div>
                        <span
                            className={cn(
                                "text-xs font-medium",
                                getConfidenceColor(question.confidence)
                            )}
                        >
                            {confidencePercent}%
                        </span>
                    </div>

                    {/* Status indicator */}
                    {isAnswered && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Check size={12} />
                            Answered
                        </span>
                    )}
                    {isSkipped && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <SkipForward size={12} />
                            Skipped
                        </span>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Context Link */}
                    {question.context.file && (
                        <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewTrace?.(question.id);
                            }}
                        >
                            <FileCode size={12} />
                            <span className="max-w-[120px] truncate">
                                {question.context.file.split("/").pop()}
                            </span>
                        </button>
                    )}

                    {/* Expand Toggle */}
                    {compact && (
                        <button className="text-muted-foreground">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    )}
                </div>

                {/* Question Content */}
                {expanded && (
                    <div className="border-t border-border/50 px-4 pb-4 pt-3">
                        {/* Question Text */}
                        <p className="mb-4 text-sm leading-relaxed text-foreground">
                            {question.text}
                        </p>

                        {/* Answer Section */}
                        {!isAnswered && !isSkipped && (
                            <div className="space-y-3">
                                {/* Multiple Choice Options */}
                                {question.options && question.options.length > 0 ? (
                                    <div className="space-y-2">
                                        {question.options.map((option) => (
                                            <button
                                                key={option.id}
                                                className={cn(
                                                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                                                    selectedOption === option.id
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                                                )}
                                                onClick={() => setSelectedOption(option.id)}
                                            >
                                                <div
                                                    className={cn(
                                                        "mt-0.5 h-4 w-4 rounded-full border-2 transition-colors",
                                                        selectedOption === option.id
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground"
                                                    )}
                                                >
                                                    {selectedOption === option.id && (
                                                        <div className="flex h-full w-full items-center justify-center">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-sm font-medium">
                                                        {option.label}
                                                    </span>
                                                    {option.description && (
                                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                                            {option.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    /* Text Answer Input */
                                    <div className="relative">
                                        <textarea
                                            value={answerText}
                                            onChange={(e) => setAnswerText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Type your answer..."
                                            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                                            rows={2}
                                        />
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSkip}
                                        className="text-muted-foreground"
                                    >
                                        <SkipForward size={14} className="mr-1" />
                                        Skip
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSubmitAnswer}
                                        disabled={
                                            question.options
                                                ? !selectedOption
                                                : !answerText.trim()
                                        }
                                    >
                                        <Send size={14} className="mr-1" />
                                        Answer
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Show answer if answered */}
                        {isAnswered && question.answer && (
                            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                                <p className="text-xs font-medium text-green-700 dark:text-green-400">
                                    Your answer:
                                </p>
                                <p className="mt-1 text-sm text-green-900 dark:text-green-100">
                                    {question.answer}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
);

QuestionCard.displayName = "QuestionCard";
