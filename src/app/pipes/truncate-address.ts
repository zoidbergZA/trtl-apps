import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncateAddress',
  pure: true
})
export class TruncateAddressPipe implements PipeTransform {

  transform(value: string, args?: any): string {
    return `${value.substr(0, 8)}......${value.substr(value.length - 6, value.length)}`;
  }
}
