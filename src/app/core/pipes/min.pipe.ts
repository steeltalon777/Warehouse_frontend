import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'min',
  standalone: true,
})
export class MinPipe implements PipeTransform {
  transform(values: number[]): number {
    if (!values || values.length === 0) return 0;
    return Math.min(...values);
  }
}
