"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
exports.json = JSON.stringify;
exports.uppercase = (str) => str.toUpperCase();
exports.lowercase = (str) => str.toLowerCase();
function date(d, format) {
    return moment(d).format(format);
}
exports.date = date;
function currency(v, precision = 2) {
    v = Number(v);
    return '￥' + v.toFixed(precision);
}
exports.currency = currency;
function percent(v, precision = 2) {
    v = Number(v);
    return (v * 100).toFixed(precision) + '%';
}
exports.percent = percent;
