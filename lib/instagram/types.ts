/** Shapes of the Instagram webhook payloads we consume. */

export interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  time: number;
  /** Present for the `comments` field. */
  changes?: WebhookChange[];
  /** Present for the `messages` field. */
  messaging?: MessagingEvent[];
}

export interface WebhookChange {
  field: string;
  value: CommentValue;
}

export interface CommentValue {
  id: string;
  text: string;
  timestamp?: string;
  from?: { id: string; username?: string };
  media?: { id: string; media_product_type?: string };
  /** Set when this comment is itself a reply to another comment. */
  parent_id?: string;
}

export interface MessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type: string }[];
  };
  /** Present when the user tapped a postback button (field `messaging_postbacks`). */
  postback?: {
    mid: string;
    title?: string;
    payload: string;
  };
}

/** A button inside a button-template message. */
export type Button =
  | { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

/** The `message` object of a Send API call. */
export type OutboundMessage =
  | { text: string }
  | {
      attachment: {
        type: "template";
        payload: { template_type: "button"; text: string; buttons: Button[] };
      };
    };

export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}
