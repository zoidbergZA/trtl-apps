export class Utilities {
  public static getAtomicUnits(amount: number): number | undefined {
    const segments = (amount + '').split('.');

    if (segments.length === 1) {
      return parseInt(segments[0], 10) * 100;
    } else if (segments.length === 2) {
      const whole = parseInt(segments[0], 10) * 100;
      let centsString = segments[1];

      if (centsString.length > 2) {
        return undefined;
      }

      if (centsString.length === 1) {
        centsString = centsString + '0';
      }

      const cents = parseInt(centsString, 10);
      return whole + cents;
    } else {
      return undefined;
    }
  }
}
