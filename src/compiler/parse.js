// src/compiler/parse.js
// DSL -> AST

/**
 * AST node shapes:
 * - Root:    { kind: "root", children: Node[] }
 * - Element: { kind: "element", tag: string, props: Record<string, any>, children: Node[] }
 * - Text:    { kind: "text", value: string }
 */

/* "button bindtap='inc'" -> {tag: "button", props: {bindtap: "inc"}} */
function parseOpenTag(raw) {
  raw = raw.trim();
  if (!raw) return { tag: "", props: {} };

  // parse tag name
  let p = 0;
  while (p < raw.length && !/\s/.test(raw[p])) p++;
  const tag = raw.slice(0, p);
  const props = {};

  // parse attributes
  while (p < raw.length) {
    // skip spaces
    while (p < raw.length && /\s/.test(raw[p])) p++;
    if (p >= raw.length) break;

    // parse attr name
    let nameStart = p;
    while (p < raw.length && !/[\s=]/.test(raw[p])) p++;
    const name = raw.slice(nameStart, p);
    if (!name) break;

    // skip spaces
    while (p < raw.length && /\s/.test(raw[p])) p++;

    // boolean attribute without "="
    if (raw[p] !== "=") {
      props[name] = true;
      continue;
    }

    // skip '=' and spaces
    p++;
    while (p < raw.length && /\s/.test(raw[p])) p++;

    // parse value (quoted or unquoted)
    let value = "";
    const quote = raw[p];

    if (quote === '"' || quote === "'") {
      // quoted
      p++;
      const valueStart = p;
      while (p < raw.length && raw[p] !== quote) p++;
      value = raw.slice(valueStart, p);

      // if quote is missing, keep value as parsed
      if (raw[p] === quote) {
        p++; // consume quote
      }
    } else {
      // unquoted: read until whitespace
      const valueStart = p;
      while (p < raw.length && !/\s/.test(raw[p])) p++;
      value = raw.slice(valueStart, p);
    }

    props[name] = value;
  }

  return { tag, props };
}

/* "/button" -> "button" */
function parseCloseTag(raw) {
  return raw.replace(/^\//, "").trim();
}

/* Provide more context in error messages */
function makeError(msg, i, template) {
  const start = Math.max(0, i - 20);
  const end = Math.min(template.length, i + 20);
  const context = template.slice(start, end).replace(/\n/g, "\\n");
  return new Error(`${msg} at ${i}. Context: "${context}"`);
}

/**
 * Parse DSL template into AST.
 * @param {string} template
 * @returns {object} root element node (kind: "element")
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

    // <tag ...> or <tag ... />
    // -> {kind: "element", tag: "tag", props: {...}, children: []}
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
    const text = template.slice(i, j === -1 ? template.length : j);

    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed) stack[stack.length - 1].children.push({ kind: "text", value: trimmed });

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