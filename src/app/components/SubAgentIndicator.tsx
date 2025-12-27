"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SubAgent } from "@/app/types/types";

interface SubAgentIndicatorProps {
  subAgent: SubAgent;
  onClick: () => void;
  isExpanded?: boolean;
}

export const SubAgentIndicator = React.memo<SubAgentIndicatorProps>(
  ({ subAgent, onClick, isExpanded = true }) => {
    return (
      <div className="w-fit max-w-full overflow-hidden rounded-lg bg-blue-50 dark:bg-blue-950/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors duration-200 hover:bg-blue-100 dark:hover:bg-blue-900/30"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-sans text-[15px] font-semibold leading-[140%] tracking-[-0.4px] text-blue-700 dark:text-blue-300">
                {subAgent.subAgentName}
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp
                size={14}
                className="shrink-0 text-blue-500"
              />
            ) : (
              <ChevronDown
                size={14}
                className="shrink-0 text-blue-500"
              />
            )}
          </div>
        </Button>
      </div>
    );
  }
);

SubAgentIndicator.displayName = "SubAgentIndicator";
