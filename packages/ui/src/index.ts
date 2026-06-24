export interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
}

export function buttonClassName(variant: ButtonProps["variant"] = "primary"): string {
  return variant === "primary" ? "button button-primary" : "button button-secondary";
}
