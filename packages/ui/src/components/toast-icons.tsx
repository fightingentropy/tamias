import type { SVGProps } from "react";
import {
  MdAutoAwesome,
  MdCheck,
  MdErrorOutline,
  MdInfoOutline,
} from "react-icons/md";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function ToastSvgIcon({
  size = 16,
  className,
  children,
  viewBox = "0 0 16 16",
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ToastAiIcon = MdAutoAwesome;
export const ToastErrorIcon = MdErrorOutline;
export const ToastInfoIcon = MdInfoOutline;

export function ToastCheckIcon(props: IconProps) {
  return (
    <ToastSvgIcon {...props}>
      <path d="m14 5.167-8 8L2.333 9.5l.94-.94L6 11.28l7.06-7.053.94.94Z" />
    </ToastSvgIcon>
  );
}
