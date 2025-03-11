import * as React from "react";
import { cn } from "@lonestone/ui/lib/utils";

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Header({ className, children, ...props }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full h-[var(--header-height)] flex items-center border-b bg-background/30 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </header>
  );
}