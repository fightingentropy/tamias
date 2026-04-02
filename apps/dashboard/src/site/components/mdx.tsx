import React from "react";
import rehypeRaw from "rehype-raw";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "sugar-high";
import Link from "@/framework/link";

interface CustomLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

function CustomLink({ href, ...props }: CustomLinkProps) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} {...props}>
        {props.children}
      </Link>
    );
  }

  if (href.startsWith("#")) {
    return <a href={href} {...props} />;
  }

  return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />;
}

interface MarkdownImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt?: string;
}

function MarkdownImage({ alt = "", src, ...props }: MarkdownImageProps) {
  if (!src) {
    return null;
  }

  return <img alt={alt} src={src} {...props} />;
}

function Code({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const value = String(children ?? "");

  if (className?.includes("language-")) {
    return (
      <code
        className={className}
        dangerouslySetInnerHTML={{ __html: highlight(value) }}
        {...props}
      />
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function slugify(str: string): string {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

function createHeading(level: number) {
  const Heading = ({ children }: { children: React.ReactNode }) => {
    const slug = slugify(children as string);

    return React.createElement(
      `h${level}`,
      { id: slug },
      [
        React.createElement("a", {
          href: `#${slug}`,
          key: `link-${slug}`,
          className: "anchor",
        }),
      ],
      children,
    );
  };

  Heading.displayName = `Heading${level}`;

  return Heading;
}

interface IframeProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  src: string;
}

function Iframe({ src, ...props }: IframeProps) {
  return <iframe src={src} {...props} />;
}

const components = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
  a: CustomLink,
  code: Code,
  img: MarkdownImage,
  image: MarkdownImage,
  iframe: Iframe,
};

interface CustomMDXProps {
  source: string;
  components?: Record<string, React.ComponentType<unknown>>;
}

export function CustomMDX({
  source,
  components: customComponents,
}: CustomMDXProps) {
  return (
    <ReactMarkdown
      components={{ ...components, ...(customComponents || {}) } as any}
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkGfm]}
    >
      {source
        .replace(/<Image\b/g, "<img")
        .replace(/<\/Image>/g, "</img>")}
    </ReactMarkdown>
  );
}
