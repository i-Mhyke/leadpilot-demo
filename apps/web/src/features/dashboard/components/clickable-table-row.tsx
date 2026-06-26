"use client";

import type { ReactNode, KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { DASHBOARD_MOTION } from "../dashboard-utils";

export function ClickableTableRow({
  to,
  params,
  search,
  className,
  children,
}: {
  to: string;
  params: Record<string, string>;
  search?: Record<string, string | undefined>;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  function openRow() {
    void navigate({ to, params, search });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRow();
    }
  }

  return (
    <tr
      className={cn("cursor-pointer", DASHBOARD_MOTION, className)}
      tabIndex={0}
      role="link"
      onClick={openRow}
      onKeyDown={onKeyDown}
    >
      {children}
    </tr>
  );
}
