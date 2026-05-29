/**
 * Throw inside an EventSubscriber consume handler to request a retry with a
 * specific delay, bypassing the default exponential ladder.
 *
 * Use for: known-transient failures where you have a good estimate of how long
 * the upstream service needs before the operation can be retried.
 */
export class RetryException extends Error {
  constructor(
    message: string,
    public readonly delayMs: number,
  ) {
    super(message);
    this.name = "RetryException";
  }
}
