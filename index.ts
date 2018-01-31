import {
  RootNode, Node, ElementNode, TextNode,
  CommentNode
} from 'ody-html-tree'
import * as filters from './filters'
import { StyleObj } from 'ody-html-tree/libs/attribute';
import { KeyToString } from 'ody-html-tree/libs/structs';

interface KeyToBoolean {
  [index: string]: Boolean
}
var passThroughKeys: PropertyKey[] = ['__data__', '__expr__', 'eval']

export function getProxyData(data: any) {
  return new Proxy(data, {
    has(target: Object, key: PropertyKey) {
      return !passThroughKeys.includes(key);
    },
    get(target: Object, key: PropertyKey) {
      return Reflect.get(target, key);
    }
  })
}

export function exec(expr: string, data: any) {
  expr = expr.toString();
  if (expr) {
    if (expr.startsWith('{')) {
      expr = `(${expr})`;
    }
    var f = new Function('__data__', '__expr__', 'with(__data__){return eval(__expr__)}')
    return f(getProxyData(data), expr);
  }
}
type DirectiveHandler = (node: ElementNode, expr: string, compiler: Compiler) => void
export var directives: { [name: string]: DirectiveHandler } = {
  class(node, expr, compiler) {
    let classes = compiler.getClass(expr);
    node.classList.add(...classes);
  },
  style(node, expr, compiler) {
    let styleObj = compiler.getStyle(expr);
    node.style.merge(styleObj);
  },
  show(node, expr, compiler) {
    let v = compiler.get(expr)
    if (v) {
      if (/^(p|div|section|h[1-6])$/.test(node.name)) {
        node.style.addString('display:block')
      } else {
        node.style.addString('display:inline')
      }
    }
  },
  hide(node, expr, compiler) {
    let v = compiler.get(expr)
    if (v) {
      node.style.addString('display:none')
    }
  },
  bind(node, expr, compiler) {
    let v = compiler.getBind(expr);
    node.attributes.add(v);
  }
}

export class Compiler {
  keyFor = '*for'
  keyIf = '*if'
  keyElseIf = '*else-if'
  keyElse = '*else'
  keySwitch = '*switch'
  keySwitchCase = '*switch-case'
  keySwitchDefault = '*switch-default'
  keyHtml = '*html'
  keyText = '*text'
  keyShow = "*show"
  keyHide = "*hide"
  keySlotScope = 'slot-scope'
  keyIs = (key: string) => key.startsWith('.')
  keyGet = (key: string) => key.substring(1)
  directives: {
    [name: string]: DirectiveHandler
  } = {}
  constructor(public data: any) {
    this.init()
  }
  init() {
    Object.keys(directives).forEach(name => {
      this.directives['*' + name] = directives[name]
    })
  }
  exec(expr: string): any {
    return exec(expr, this.data)
  }
  execWithFilters(str: string) {
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
  replaceExpression(str: string): string {
    return str.replace(/\{%(.*?)%\}/g, (_, content) => this.execWithFilters(content));
  }
  getFor(str: string): any[] {
    var reg = /\s+(?:in|of)\s+/;
    var [prefix, expr] = str.split(reg)
    var items: any = this.execWithFilters(expr);
    var data = this.data;
    prefix = prefix.trim();
    var keyItem: string, keyName: string;
    if (prefix.startsWith('(')) {
      [keyItem, keyName] = prefix.substring(1, prefix.length - 1).split(/\s*,\s*/)
    } else {
      keyItem = prefix;
    }
    var ret: any[];
    function getItem(value: any, key: PropertyKey) {
      var obj: any = {};
      Object.setPrototypeOf(obj, data);
      if (keyName) {
        obj[keyName] = key;
      }
      obj[keyItem] = value;
      return obj;
    }
    if (Array.isArray(items)) {
      ret = items.map(getItem)
    } else if (items) {
      ret = Object.keys(items).map(name => getItem(items[name], name));
    } else {
      ret = [];
    }
    return ret;
  }
  getIf(expr: string): boolean {
    return this.exec(expr);
  }
  getElseIf(expr: string): boolean {
    return this.exec(expr);
  }
  getSwitch(expr: string): any {
    return this.exec(expr);
  }
  getSwitchCase(expr: string): any {
    return this.exec(expr);
  }
  getClass(expr: string): string[] {
    let ret: string[] = [];
    let v: string | KeyToBoolean | (string | KeyToBoolean)[] = this.exec(expr);
    if (Array.isArray(v)) {
      v.reduce((state, item) => {
        if (typeof item === 'string') {
          state.push(item);
        } else {
          var names = Object.keys(item).filter(item => item[name]);
          state.push(...names);
        }
        return state;
      }, ret)
    } else if (typeof v === 'string') {
      ret.push(v);
    } else {
      Object.keys(v).forEach(name => {
        if ((<KeyToBoolean>v)[name]) {
          ret.push(name);
        }
      })
    }
    return ret;
  }
  getStyle(expr: string): StyleObj {
    var v: string | KeyToString | (string | KeyToString)[] = this.exec(expr);
    var ret = new StyleObj();
    if (Array.isArray(v)) {
      v.forEach(item => {
        if (typeof item === 'string') {
          ret.addString(item)
        } else {
          ret.add(item);
        }
      });
    } else if (typeof v === 'string') {
      ret.addString(v);
    } else {
      ret.add(v);
    }
    return ret;
  }
  getBind(expr: string): KeyToString {
    return this.exec(expr);
  }
  getHtml(expr: string): any {
    return this.execWithFilters(expr);
  }
  get(expr: string) {
    return this.execWithFilters(expr);
  }
  getSlotScope(expr: string, data: any) {
    if (/^\s*\{(.*)\}\s*$/.test(expr)) {
      let ret: any = {};
      let items = RegExp.$1.split(',').forEach(name => {
        name = name.trim();
        ret[name] = data[name];
      })
      return ret;
    }
    return { [expr]: data }
  }
}

export default function (root: RootNode, data: any) {
  renderData(root.childNodes, data);
}

export function renderData(nodes: Node[], data: any) {
  var prevIsTrue = false;
  var compiler = new Compiler(data)
  nodes.forEach(node => {
    if (node instanceof ElementNode) {
      if (node.hasAttribute(compiler.keySlotScope)) {
        if (node.external.needRender) {
          delete node.external.needRender
          let data = compiler.getSlotScope(node.getAttribute(compiler.keySlotScope), node.parentNode ? node.parentNode.attributes.attrs : {})
          node.removeAttribute(compiler.keySlotScope)
          renderData([node], data)
        }
        return;
      }
      if (node.hasAttribute(compiler.keyFor)) {
        let datas = compiler.getFor(node.getAttribute(compiler.keyFor));
        node.removeAttribute(compiler.keyFor);
        let prevNode = node
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
      } else if (node.hasAttribute(compiler.keyElseIf)) {
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
      } else if (node.hasAttribute(compiler.keyElse)) {
        if (prevIsTrue) {
          node.remove();
          return;
        }
        node.removeAttribute(compiler.keyElse);
      }
      if (node.hasAttribute(compiler.keySwitch)) {
        let v = compiler.getSwitch(node.getAttribute(compiler.keySwitch));
        let item = <ElementNode | undefined>node.childNodes.find(node => {
          if (node instanceof ElementNode) {
            if (node.hasAttribute(compiler.keySwitchCase)) {
              let _v = compiler.getSwitchCase(node.getAttribute(compiler.keySwitchCase));
              if (_v === v) {
                node.removeAttribute(compiler.keySwitchCase);
                return true;
              }
            } else if (node.hasAttribute(compiler.keySwitchDefault)) {
              node.removeAttribute(compiler.keySwitchDefault);
              return true;
            } else {
              warn('switch孩子节点上缺少指令');
            }
          } else if (!(node instanceof CommentNode)) {
            if (node instanceof TextNode) {
              if (node.text.trim().length > 0) {
                warn('switch的孩子只能为元素节点');
              }
            }
          }
          return false;
        })
        if (item) {
          node.childNodes = [item];
        } else {
          node.empty();
        }
        node.removeAttribute(compiler.keySwitch);
      }
      Object.keys(compiler.directives).forEach(name => {
        if (node.hasAttribute(name)) {
          compiler.directives[name](node, node.getAttribute(name), compiler)
          node.removeAttribute(name)
        }
      })
      let deep = true;
      if (node.hasAttribute(compiler.keyText)) {
        let v = compiler.getHtml(node.getAttribute(compiler.keyText))
        node.text(v);
        node.removeAttribute(compiler.keyText);
        deep = false;
      }
      if (node.hasAttribute(compiler.keyHtml)) {
        let v = compiler.getHtml(node.getAttribute(compiler.keyHtml))
        node.text(v);
        node.removeAttribute(compiler.keyHtml);
        deep = false;
      }
      node.attributes.keys.filter(compiler.keyIs).forEach(name => {
        let v = compiler.get(node.getAttribute(name));
        node.removeAttribute(name);
        node.setAttribute(compiler.keyGet(name), v);
        // deep = false;
      })
      /* if (node.name === 'script') {
        node.external.variables = data;
      } else */
      if (deep && node.name !== 'style' && node.childNodes.length > 0) {
        renderData(node.childNodes, data);
      }
    } else if (node instanceof TextNode) {
      node.text = compiler.replaceExpression(node.text);
    }
  })
}

function warn(str: string) {
  console.warn('【warning】', str);
}