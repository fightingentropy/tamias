export type EmailAddress = string | { email: string; name: string };

export type EmailAttachment = {
  content: string | ArrayBuffer | ArrayBufferView;
  filename: string;
  type?: string;
  disposition?: "attachment" | "inline";
  contentId?: string;
};

export type EmailMessage = {
  from: EmailAddress;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: EmailAddress;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
};

type CloudflareEmailAttachment =
  | {
      disposition: "attachment";
      filename: string;
      type: string;
      content: string | ArrayBuffer | ArrayBufferView;
    }
  | {
      disposition: "inline";
      contentId: string;
      filename: string;
      type: string;
      content: string | ArrayBuffer | ArrayBufferView;
    };

type CloudflareEmailMessage = Omit<EmailMessage, "attachments"> & {
  attachments?: CloudflareEmailAttachment[];
};

export type CloudflareEmailBinding = {
  send(message: CloudflareEmailMessage): Promise<{ messageId?: string }>;
};

let emailBinding: CloudflareEmailBinding | null = null;

export function configureEmailRuntime(binding: CloudflareEmailBinding | null | undefined) {
  emailBinding = binding ?? null;
}

function getEmailBinding() {
  if (!emailBinding) {
    throw new Error("Missing Cloudflare Email Service EMAIL binding");
  }

  return emailBinding;
}

function getAttachmentType(attachment: EmailAttachment) {
  if (attachment.type) {
    return attachment.type;
  }

  if (attachment.filename.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }

  return "application/octet-stream";
}

function toCloudflareAttachment(attachment: EmailAttachment): CloudflareEmailAttachment {
  const base = {
    filename: attachment.filename,
    type: getAttachmentType(attachment),
    content: attachment.content,
  };

  if (attachment.disposition === "inline") {
    if (!attachment.contentId) {
      throw new Error(`Inline email attachment ${attachment.filename} is missing contentId`);
    }

    return {
      ...base,
      disposition: "inline",
      contentId: attachment.contentId,
    };
  }

  return {
    ...base,
    disposition: "attachment",
  };
}

function toCloudflareAddress(address: EmailAddress): EmailAddress {
  if (typeof address !== "string") {
    return address;
  }

  const displayAddress = address.match(/^\s*(?:"?([^"]*?)"?\s*)?<([^<>@\s]+@[^<>@\s]+)>\s*$/);
  if (!displayAddress) {
    return address;
  }

  const rawName = displayAddress[1];
  const email = displayAddress[2];
  if (!email) {
    return address;
  }

  const name = rawName?.trim();
  if (!name) {
    return email;
  }

  return { email, name };
}

function toCloudflareMessage(message: EmailMessage): CloudflareEmailMessage {
  const { attachments, ...rest } = message;

  return {
    ...rest,
    from: toCloudflareAddress(rest.from),
    ...(rest.replyTo ? { replyTo: toCloudflareAddress(rest.replyTo) } : {}),
    ...(attachments ? { attachments: attachments.map(toCloudflareAttachment) } : {}),
  };
}

export async function sendEmail(message: EmailMessage) {
  return getEmailBinding().send(toCloudflareMessage(message));
}
