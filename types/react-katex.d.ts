declare module "react-katex" {
  import { ComponentProps } from "react";
  export function InlineMath(props: { math: string } & ComponentProps<"span">): JSX.Element;
  export function BlockMath(props: { math: string } & ComponentProps<"div">): JSX.Element;
}
