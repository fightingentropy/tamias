"use client";

import type { CSSProperties, ImgHTMLAttributes } from "react";
import { forwardRef } from "react";

type StaticImportLike = {
  src: string;
  width?: number;
  height?: number;
};

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | StaticImportLike;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  onLoadingComplete?: (img: HTMLImageElement) => void;
};

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    fill,
    priority: _priority,
    quality: _quality,
    unoptimized: _unoptimized,
    onLoadingComplete,
    style,
    width,
    height,
    ...props
  },
  ref,
) {
  const resolvedSrc = typeof src === "string" ? src : src.src;
  const resolvedWidth = width ?? (typeof src === "object" ? src.width : undefined);
  const resolvedHeight =
    height ?? (typeof src === "object" ? src.height : undefined);
  const imageStyle: CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }
    : style ?? {};

  return (
    <img
      ref={ref}
      src={resolvedSrc}
      width={resolvedWidth}
      height={resolvedHeight}
      style={imageStyle}
      onLoad={(event) => {
        props.onLoad?.(event);
        onLoadingComplete?.(event.currentTarget);
      }}
      {...props}
    />
  );
});

export default Image;
