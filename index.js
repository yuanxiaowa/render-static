"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const html_tree_1 = require("ody-html-tree");
const filters = require("./filters");
const attribute_1 = require("ody-html-tree/libs/attribute");
var passThroughKeys = ['__data__', '__expr__', 'eval'];
function getProxyData(data) {
    return new Proxy(data, {
        has(target, key) {
            return !passThroughKeys.includes(key);
        },
        get(target, key) {
            return Reflect.get(target, key);
        }
    });
}
exports.getProxyData = getProxyData;
function exec(expr, data) {
    expr = expr.toString();
    if (expr) {
        if (expr.startsWith('{')) {
            expr = `(${expr})`;
        }
        var f = new Function('__data__', '__expr__', 'with(__data__){return eval(__expr__)}');
        return f(getProxyData(data), expr);
    }
}
exports.exec = exec;
exports.directives = {
    class(node, expr, compiler) {
        let classes = compiler.getClass(expr);
        node.classList.add(...classes);
    },
    style(node, expr, compiler) {
        let styleObj = compiler.getStyle(expr);
        node.style.merge(styleObj);
    },
    show(node, expr, compiler) {
        let v = compiler.get(expr);
        if (v) {
            if (/^(p|div|section|h[1-6])$/.test(node.name)) {
                node.style.addString('display:block');
            }
            else {
                node.style.addString('display:inline');
            }
        }
    },
    hide(node, expr, compiler) {
        let v = compiler.get(expr);
        if (v) {
            node.style.addString('display:none');
        }
    },
    bind(node, expr, compiler) {
        let v = compiler.getBind(expr);
        node.attributes.add(v);
    }
};
class Compiler {
    constructor(data) {
        this.data = data;
        this.keyFor = '*for';
        this.keyIf = '*if';
        this.keyElseIf = '*else-if';
        this.keyElse = '*else';
        this.keySwitch = '*switch';
        this.keySwitchCase = '*switch-case';
        this.keySwitchDefault = '*switch-default';
        this.keyHtml = '*html';
        this.keyText = '*text';
        this.keyShow = "*show";
        this.keyHide = "*hide";
        this.keySlotScope = 'slot-scope';
        this.keyIs = (key) => key.startsWith('.');
        this.keyGet = (key) => key.substring(1);
        this.directives = {};
        this.init();
    }
    init() {
        Object.keys(exports.directives).forEach(name => {
            this.directives['*' + name] = exports.directives[name];
        });
    }
    exec(expr) {
        return exec(expr, this.data);
    }
    execWithFilters(str) {
        // 字符串中含有|会出问题，待优化
        var [expr, ...efilters] = str.split('|');
        var ret = this.exec(expr);
        if (efilters.length > 0) {
            ret = efilters.reduce((state, item) => {
                var [name, ...params] = item.split(':');
                // @ts-ignore
                var f = filters[name];
                if (!f) {
                    warn(`不存在${name}方法`);
                    return state;
                }
                params = params.map(param => this.exec(param));
                return f(state, ...params);
            }, ret);
        }
        return ret;
    }
    replaceExpression(str) {
        return str.replace(/\{%(.*?)%\}/g, (_, content) => this.execWithFilters(content));
    }
    getFor(str) {
        var reg = /\s+(?:in|of)\s+/;
        var [prefix, expr] = str.split(reg);
        var items = this.execWithFilters(expr);
        var data = this.data;
        prefix = prefix.trim();
        var keyItem, keyName;
        if (prefix.startsWith('(')) {
            [keyItem, keyName] = prefix.substring(1, prefix.length - 1).split(/\s*,\s*/);
        }
        else {
            keyItem = prefix;
        }
        var ret;
        function getItem(value, key) {
            var obj = {};
            Object.setPrototypeOf(obj, data);
            if (keyName) {
                obj[keyName] = key;
            }
            obj[keyItem] = value;
            return obj;
        }
        if (Array.isArray(items)) {
            ret = items.map(getItem);
        }
        else if (items) {
            ret = Object.keys(items).map(name => getItem(items[name], name));
        }
        else {
            ret = [];
        }
        return ret;
    }
    getIf(expr) {
        return this.exec(expr);
    }
    getElseIf(expr) {
        return this.exec(expr);
    }
    getSwitch(expr) {
        return this.exec(expr);
    }
    getSwitchCase(expr) {
        return this.exec(expr);
    }
    getClass(expr) {
        let ret = [];
        let v = this.exec(expr);
        if (Array.isArray(v)) {
            v.reduce((state, item) => {
                if (typeof item === 'string') {
                    state.push(item);
                }
                else {
                    var names = Object.keys(item).filter(item => item[name]);
                    state.push(...names);
                }
                return state;
            }, ret);
        }
        else if (typeof v === 'string') {
            ret.push(v);
        }
        else {
            Object.keys(v).forEach(name => {
                if (v[name]) {
                    ret.push(name);
                }
            });
        }
        return ret;
    }
    getStyle(expr) {
        var v = this.exec(expr);
        var ret = new attribute_1.StyleObj();
        if (Array.isArray(v)) {
            v.forEach(item => {
                if (typeof item === 'string') {
                    ret.addString(item);
                }
                else {
                    ret.add(item);
                }
            });
        }
        else if (typeof v === 'string') {
            ret.addString(v);
        }
        else {
            ret.add(v);
        }
        return ret;
    }
    getBind(expr) {
        return this.exec(expr);
    }
    getHtml(expr) {
        return this.execWithFilters(expr);
    }
    get(expr) {
        return this.execWithFilters(expr);
    }
    getSlotScope(expr, data) {
        if (/^\s*\{(.*)\}\s*$/.test(expr)) {
            let ret = {};
            let items = RegExp.$1.split(',').forEach(name => {
                name = name.trim();
                ret[name] = data[name];
            });
            return ret;
        }
        return { [expr]: data };
    }
}
exports.Compiler = Compiler;
function default_1(root, data) {
    renderData(root.childNodes, data);
}
exports.default = default_1;
function renderData(nodes, data) {
    var prevIsTrue = false;
    var compiler = new Compiler(data);
    nodes.forEach(node => {
        if (node instanceof html_tree_1.ElementNode) {
            if (node.hasAttribute(compiler.keySlotScope)) {
                if (node.external.needRender) {
                    delete node.external.needRender;
                    let data = compiler.getSlotScope(node.getAttribute(compiler.keySlotScope), node.parentNode ? node.parentNode.attributes.attrs : {});
                    node.removeAttribute(compiler.keySlotScope);
                    renderData([node], data);
                }
                return;
            }
            if (node.hasAttribute(compiler.keyFor)) {
                let datas = compiler.getFor(node.getAttribute(compiler.keyFor));
                node.removeAttribute(compiler.keyFor);
                let prevNode = node;
                datas.forEach(data => {
                    var item = node.clone();
                    renderData([item], data);
                    prevNode.after(item);
                    prevNode = item;
                });
                node.remove();
                return;
            }
            if (node.hasAttribute(compiler.keyIf)) {
                prevIsTrue = compiler.getIf(node.getAttribute(compiler.keyIf));
                if (!prevIsTrue) {
                    node.remove();
                    return;
                }
                node.removeAttribute(compiler.keyIf);
            }
            else if (node.hasAttribute(compiler.keyElseIf)) {
                if (prevIsTrue) {
                    node.remove();
                    return;
                }
                prevIsTrue = compiler.getElseIf(node.getAttribute(compiler.keyElseIf));
                if (!prevIsTrue) {
                    node.remove();
                    return;
                }
                node.removeAttribute(compiler.keyElseIf);
            }
            else if (node.hasAttribute(compiler.keyElse)) {
                if (prevIsTrue) {
                    node.remove();
                    return;
                }
                node.removeAttribute(compiler.keyElse);
            }
            if (node.hasAttribute(compiler.keySwitch)) {
                let v = compiler.getSwitch(node.getAttribute(compiler.keySwitch));
                let item = node.childNodes.find(node => {
                    if (node instanceof html_tree_1.ElementNode) {
                        if (node.hasAttribute(compiler.keySwitchCase)) {
                            let _v = compiler.getSwitchCase(node.getAttribute(compiler.keySwitchCase));
                            if (_v === v) {
                                node.removeAttribute(compiler.keySwitchCase);
                                return true;
                            }
                        }
                        else if (node.hasAttribute(compiler.keySwitchDefault)) {
                            node.removeAttribute(compiler.keySwitchDefault);
                            return true;
                        }
                        else {
                            warn('switch孩子节点上缺少指令');
                        }
                    }
                    else if (!(node instanceof html_tree_1.CommentNode)) {
                        if (node instanceof html_tree_1.TextNode) {
                            if (node.text.trim().length > 0) {
                                warn('switch的孩子只能为元素节点');
                            }
                        }
                    }
                    return false;
                });
                if (item) {
                    node.childNodes = [item];
                }
                else {
                    node.empty();
                }
                node.removeAttribute(compiler.keySwitch);
            }
            Object.keys(compiler.directives).forEach(name => {
                if (node.hasAttribute(name)) {
                    compiler.directives[name](node, node.getAttribute(name), compiler);
                    node.removeAttribute(name);
                }
            });
            let deep = true;
            if (node.hasAttribute(compiler.keyText)) {
                let v = compiler.getHtml(node.getAttribute(compiler.keyText));
                node.text(v);
                node.removeAttribute(compiler.keyText);
                deep = false;
            }
            if (node.hasAttribute(compiler.keyHtml)) {
                let v = compiler.getHtml(node.getAttribute(compiler.keyHtml));
                node.text(v);
                node.removeAttribute(compiler.keyHtml);
                deep = false;
            }
            node.attributes.keys.filter(compiler.keyIs).forEach(name => {
                let v = compiler.get(node.getAttribute(name));
                node.removeAttribute(name);
                node.setAttribute(compiler.keyGet(name), v);
                // deep = false;
            });
            /* if (node.name === 'script') {
              node.external.variables = data;
            } else */
            if (deep && node.name !== 'style' && node.childNodes.length > 0) {
                renderData(node.childNodes, data);
            }
        }
        else if (node instanceof html_tree_1.TextNode) {
            node.text = compiler.replaceExpression(node.text);
        }
    });
}
exports.renderData = renderData;
function warn(str) {
    console.warn('【warning】', str);
}
