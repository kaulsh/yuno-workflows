/**
 * Throw inside an EventSubscriber consume handler to permanently drop a message.
 *
 * The message is rejected (requeue=false) and routed to the queue's configured
 * dead-letter exchange (if any). No retry is attempted.
 *
 * Use for: malformed payloads that passed schema validation but are logically
 * invalid, business-rule skips, poison messages.
 */
export class DiscardException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscardException";
  }
}
