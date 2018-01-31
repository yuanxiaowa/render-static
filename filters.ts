import * as moment from 'moment'

export var json = JSON.stringify
export var uppercase = (str: string) => str.toUpperCase()
export var lowercase= (str: string) => str.toLowerCase()
export function date(d: Date | string, format?: string) {
  return moment(d).format(format);
}
export function currency(v: number | string, precision = 2) {
  v = Number(v);
  return '￥' + v.toFixed(precision);
}
export function percent(v: number | string, precision = 2) {
  v = Number(v);
  return (v * 100).toFixed(precision) + '%';
}