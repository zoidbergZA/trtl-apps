import { Pipe, PipeTransform } from '@angular/core';
import { formatCurrency } from '@angular/common';

@Pipe({
  name: 'TRTL',
  pure: true
})
export class TurtleAmountPipe implements PipeTransform {

  transform(value: number, hideSymbol?: boolean): string {
    const symbol = hideSymbol ? ' ' : 'TRTL ';
    return formatCurrency(value / 100, 'en-US', symbol);
  }
}
