import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach } from "vitest";
import { vi } from "vitest";

vi.mock("vaul", () => {
  const Root = ({
    open = true,
    children,
  }: {
    open?: boolean;
    children?: React.ReactNode;
  }) => {
    return open ? React.createElement(React.Fragment, null, children) : null;
  };

  const Passthrough = ({
    children,
  }: {
    children?: React.ReactNode;
  }) => React.createElement(React.Fragment, null, children);

  return {
    Drawer: {
      Root,
      Trigger: Passthrough,
      Portal: Passthrough,
      Close: Passthrough,
      Overlay: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        ({ children: _children, ...props }, ref) =>
          React.createElement("div", { ref, ...props }),
      ),
      Content: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        ({ children, ...props }, ref) =>
          React.createElement("div", { ref, ...props }, children),
      ),
      Title: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
        ({ children, ...props }, ref) => React.createElement("h2", { ref, ...props }, children),
      ),
      Description: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
        ({ children, ...props }, ref) => React.createElement("p", { ref, ...props }, children),
      ),
    },
  };
});

afterEach(() => {
  cleanup();
});
