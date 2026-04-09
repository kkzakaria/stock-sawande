"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MobileCardContent, MobileCardBadgeVariant } from "@/types/data-table";

interface DataTableCardProps {
  content: MobileCardContent;
  selected: boolean;
  selectionMode: boolean;
  onTap: () => void;
  onLongPressActivate: () => void;
  actionsLabel: string;
}

const BADGE_CLASSES: Record<MobileCardBadgeVariant, string> = {
  default: "bg-muted text-foreground",
  success: "bg-green-500/15 text-green-600 dark:text-green-400",
  warning: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

export function DataTableCard({
  content,
  selected,
  selectionMode,
  onTap,
  onLongPressActivate,
  actionsLabel,
}: DataTableCardProps) {
  const timerRef = React.useRef<number | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (selectionMode) return;
    longPressFiredRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      if ("vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
      onLongPressActivate();
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE_PX) {
      clearTimer();
    }
  };

  const handlePointerUp = () => {
    clearTimer();
    startRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      e.preventDefault();
      longPressFiredRef.current = false;
      return;
    }
    onTap();
  };

  const badgeVariant = content.badge?.variant ?? "default";

  return (
    <div
      role="listitem"
      className={cn(
        "group relative rounded-lg border bg-card transition-colors",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg p-3 text-left",
          "touch-manipulation select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:bg-muted/40 active:bg-muted/60",
          !selectionMode && content.menuItems && content.menuItems.length > 0 && "pr-11",
        )}
      >
        {selectionMode && (
          <Checkbox
            checked={selected}
            className="pointer-events-none motion-safe:animate-in motion-safe:fade-in"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {content.thumbnail && (
          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
            {content.thumbnail}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{content.title}</div>
          {content.subtitle && (
            <div className="truncate text-xs text-muted-foreground">{content.subtitle}</div>
          )}
          {content.details && (
            <div className="mt-0.5 truncate text-[clamp(10px,2.8vw,12px)] font-semibold tabular-nums">
              {content.details}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {content.rightValue && (
            <div className="text-xs font-semibold tabular-nums whitespace-nowrap">{content.rightValue}</div>
          )}
          {content.badge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                BADGE_CLASSES[badgeVariant],
              )}
            >
              {content.badge.label}
            </span>
          )}
        </div>
      </button>

      {!selectionMode && content.menuItems && content.menuItems.length > 0 && (
        <div className="absolute right-1 top-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
                aria-label={actionsLabel}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {content.menuItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={i}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={cn(item.variant === "destructive" && "text-destructive")}
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
