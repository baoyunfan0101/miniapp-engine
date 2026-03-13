/**
 * src/compiler/parse.js
 * DSL -> AST
 *
 * AST node shapes:
 * - Root:
 *   { kind: "root", children: AstNode[] }
 *
 * - Element:
 *   {
 *     kind: "element",
 *     tag: string,
 *     props: Array<AstAttr | AstDirective>,
 *     children: AstNode[]
 *   }
 *
 * - Text:
 *   { kind: "text", content: string }
 *
 * - Interpolation:
 *   { kind: "interp", content: string }
 *
 * - Attribute:
 *   { kind: "attr", name: string, value: string | true }
 *
 * - Directive:
 *   {
 *     kind: "directive",
 *     name: "bind" | "if" | "elif" | "else" | "on",
 *     arg: string | null,
 *     exp: string | null
 *   }
 */

import { normalizeExpr } from "./expression.js";

/**
 * Create a parse error with source context.
 * @param {string} message
 * @param {number} index
 * @param {string} template
 * @returns {Error}
 */
function makeError(msg, i, template) {
  const start = Math.max(0, i - 20);
  const end = Math.min(template.length, i + 20);
  const context = template.slice(start, end).replace(/\n/g, "\\n");
  return new Error(`${msg} at ${i}. Context: "${context}"`);
}

/**
 * Read a quoted or unquoted attribute value.
 * @param {string} raw
 * @param {number} index
 * @returns {{ value: string, next: number }}
 */
function readAttrValue(raw, index) {
  let p = index;

  // skip spaces
  while (p < raw.length && /\s/.test(raw[p])) p++;

  const quote = raw[p];

  // quoted
  if (quote === '"' || quote === "'") {
    p++;
    const valueStart = p;

    while (p < raw.length && raw[p] !== quote) p++;

    const value = raw.slice(valueStart, p);

    if (raw[p] === quote) p++;

    return { value, next: p };
  }

  // unquoted
  const valueStart = p;
  while (p < raw.length && !/\s/.test(raw[p])) p++;

  return {
    value: raw.slice(valueStart, p),
    next: p,
  };
}

/**
 * Convert an attribute name and value into a semantic AST prop node.
 * Supported forms:
 * - class="btn"            -> attr
 * - :class="cls"           -> directive(bind, class, "cls")
 * - tt:if="count > 0"      -> directive(if, null, "count > 0")
 * - tt:elif="count > 1"    -> directive(elif, null, "count > 1")
 * - tt:else                -> directive(else, null, null)
 * - bindtap="inc"          -> directive(on, "tap", "inc")
 * @param {string} name
 * @param {string | true} value
 * @returns {object}
 */
function toSemanticProp(name, value) {
  if (name.startsWith(":")) {
    return {
      kind: "directive",
      name: "bind",
      arg: name.slice(1),
      exp: typeof value === "string" ? normalizeExpr(value) : null,
    };
  }

  if (name === "tt:if") {
    return {
      kind: "directive",
      name: "if",
      arg: null,
      exp: typeof value === "string" ? normalizeExpr(value) : null,
    };
  }

  if (name === "tt:elif") {
    return {
      kind: "directive",
      name: "elif",
      arg: null,
      exp: typeof value === "string" ? normalizeExpr(value) : null,
    };
  }

  if (name === "tt:else") {
    return {
      kind: "directive",
      name: "else",
      arg: null,
      exp: null,
    };
  }

  if (name.startsWith("bind")) {
    return {
      kind: "directive",
      name: "on",
      arg: name.slice(4),
      exp: typeof value === "string" ? normalizeExpr(value) : null,
    };
  }

  return {
    kind: "attr",
    name,
    value,
  };
}

/**
 * Parse an open tag source.
 * Example:
 *   "button class='btn' :disabled='count===0' bindtap='inc'"
 * @param {string} raw
 * @returns {{ tag: string, props: object[] }}
 */
function parseOpenTag(raw) {
  const source = raw.trim();
  if (!source) return { tag: "", props: [] };

  // parse tag name
  let p = 0;

  while (p < source.length && !/\s/.test(source[p])) p++;
  const tag = source.slice(0, p);

  const props = [];

  // parse attributes
  while (p < source.length) {
    // skip spaces
    while (p < source.length && /\s/.test(source[p])) p++;
    if (p >= source.length) break;

    // parse attr name
    let nameStart = p;
    while (p < source.length && !/[\s=]/.test(source[p])) p++;
    const name = source.slice(nameStart, p);
    if (!name) break;

    // skip spaces before '='
    while (p < source.length && /\s/.test(source[p])) p++;

    // boolean attribute without '='
    if (source[p] !== "=") {
      props.push(toSemanticProp(name, true));
      continue;
    }

    // skip '=' and parse value
    p++;
    const { value, next } = readAttrValue(source, p);
    p = next;

    props.push(toSemanticProp(name, value));
  }

  return { tag, props };
}

/**
 * Parse a close tag source.
 * Example:
 *   "/view" -> "view"
 * @param {string} raw
 * @returns {string}
 */
function parseCloseTag(raw) {
  return raw.replace(/^\//, "").trim();
}

/**
 * Parse raw text into semantic child nodes.
 * @param {string} text
 * @returns {object[]}
 */
function parseTextNodes(text) {
  const source = String(text ?? "");
  const nodes = [];
  const re = /\{\{\s*([\s\S]*?)\s*\}\}/g;

  let lastIndex = 0;
  let match;

  while ((match = re.exec(source))) {
    const start = match.index;
    const end = re.lastIndex;

    // push static text before interpolation
    if (start > lastIndex) {
      const staticText = source.slice(lastIndex, start).replace(/\s+/g, " ").trim();
      if (staticText) {
        nodes.push({
          kind: "text",
          content: staticText,
        });
      }
    }

    // push interpolation node
    const expr = normalizeExpr(match[1]);
    if (expr) {
      nodes.push({
        kind: "interp",
        content: expr,
      });
    }

    lastIndex = end;
  }

  // push trailing static text
  if (lastIndex < source.length) {
    const staticText = source.slice(lastIndex).replace(/\s+/g, " ").trim();
    if (staticText) {
      nodes.push({
        kind: "text",
        content: staticText,
      });
    }
  }

  return nodes;
}

/**
 * Parse a DSL template string into semantic AST.
 * @param {string} template
 * @returns {object} root element node
 */
export function parse(template) {
  if (typeof template !== "string") {
    throw new Error(`Template must be a string, got ${typeof template}`);
  }

  let i = 0;
  const stack = [{ kind: "root", children: [] }];

  while (i < template.length) {
    // <!-- comment -->
    if (template.startsWith("<!--", i)) {
      const j = template.indexOf("-->", i + 4);
      if (j === -1) throw makeError("Unclosed comment", i, template);
      i = j + 3;
      continue;
    }

    // <! ...> (<!DOCTYPE ...>)
    if (template.startsWith("<!", i)) {
      const j = template.indexOf(">", i);
      if (j === -1) throw makeError("Malformed markup starting with <! ...", i, template);
      const snippet = template.slice(i, j + 1);
      throw makeError(`Unsupported markup: ${snippet}`, i, template);
    }

    // </tag>
    if (template.startsWith("</", i)) {
      const j = template.indexOf(">", i);
      if (j === -1) throw makeError("Missing '>' for close tag", i, template);

      const raw = template.slice(i + 1, j).trim(); // "/view"
      const closeTag = parseCloseTag(raw);

      // stack[0] is a virtual root
      if (stack.length <= 1) throw makeError(`Unexpected closing tag </${closeTag}>`, i, template);

      const top = stack[stack.length - 1];
      if (top.tag !== closeTag) throw makeError(`Mismatched closing tag </${closeTag}>, expected </${top.tag}>`, i, template);

      stack.pop();
      i = j + 1;
      continue;
    }

    // <tag ...> or <tag ... /> -> {kind: "element", tag: "tag", props: [...], children: []}
    if (template[i] === "<") {
      const j = template.indexOf(">", i);
      if (j === -1) throw makeError("Missing '>' for open tag", i, template);

      let raw = template.slice(i + 1, j).trim(); // "view"
      const selfClosing = raw.endsWith("/");

      // "<tag ... />" -> "tag ..."
      if (selfClosing) raw = raw.slice(0, -1).trim();

      const { tag, props } = parseOpenTag(raw);
      if (!tag) throw makeError("Empty tag name", i, template);

      const node = { kind: "element", tag, props, children: [] };
      stack[stack.length - 1].children.push(node);

      if (!selfClosing) stack.push(node);

      i = j + 1;
      continue;
    }

    // #text (innerHTML) -> {kind: "text", value: "..."}
    const j = template.indexOf("<", i);
    const rawText = template.slice(i, j === -1 ? template.length : j);
    const textNodes = parseTextNodes(rawText);

    for (const node of textNodes) {
      stack[stack.length - 1].children.push(node);
    }

    i = j === -1 ? template.length : j;
  }

  // if stack has more than the root, there are unclosed tags
  if (stack.length !== 1) {
    const unclosed = stack[stack.length - 1];
    throw new Error(`Unclosed tag <${unclosed.tag}>`);
  }

  // only one root element is allowed
  const roots = stack[0].children.filter(Boolean);
  if (roots.length === 0) throw new Error("Empty template");
  if (roots.length > 1) throw new Error("Template must have exactly one root element");

  return roots[0];
}