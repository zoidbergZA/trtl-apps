import * as crypto from 'crypto';

export function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  });
}

export function generateRandomPaymentId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// a signature segment is 1/2 the length of a payment ID
export function generateRandomSignatureSegement(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Returns a number whose value is limited to the given range.
 *
 * Example: limit the output of this computation to between 0 and 255
 * (x * 255).clamp(0, 255)
 *
 * @param min The lower boundary of the output range
 * @param max The upper boundary of the output range
 * @returns A number in the range [min, max]
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
