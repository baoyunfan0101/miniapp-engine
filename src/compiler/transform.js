// src/compiler/transform.js
// AST -> Intermediate Representation (IR)

import { compileExpr, normalizeExpr } from "./expression.js";

/**
 * Text parts:
 * - { kind: "static", value: string }
 * - { kind: "expr", expr: string, fn: (scope)=>any }
 *
 * Transformed nodes:
 * - Element:
 *   {
 *     kind: "element",
 *     tag,
 *     props,
 *     directives?: { cond?: { kind, expr, fn } },
 *     children: Node[]
 *   }
 *
 * - Text:
 *   {
 *     kind: "text",
 *     parts: Part[]
 *   }
 */

// DSL directive definitions
const COND_ATTRS = {
  "tt:if": "if",
  "tt:elif": "elif",
  "tt:else": "else",
};

/* "a={{count+1}}" -> [{kind: "static", ...}, {kind: "expr", ...}] */
export function splitTextParts(text) {
  const s = String(text ?? "");
  const parts = [];

  // non-greedy match for {{ ... }}
  const re = /\{\{\s*([\s\S]*?)\s*\}\}/g;

  let lastIndex = 0;
  let m;

  while ((m = re.exec(s))) {
    const start = m.index;
    const end = re.lastIndex;

    // static before expression
    if (start > lastIndex) {
      const staticText = s.slice(lastIndex, start);
      if (staticText) parts.push({ kind: "static", value: staticText });
    }

    const rawExpr = m[1]; // inside {{ }}
    const expr = normalizeExpr(rawExpr); // trims

    parts.push({
      kind: "expr",
      expr,
      fn: compileExpr(expr),
    });

    lastIndex = end;
  }

  // trailing static
  if (lastIndex < s.length) {
    const staticText = s.slice(lastIndex);
    if (staticText) parts.push({ kind: "static", value: staticText });
  }

  // if no mustache matched, keep it as one static part
  if (parts.length === 0) {
    parts.push({ kind: "static", value: s });
  }

  return parts;
}

/* tt:if -> directives.cond (kind: "if")
 * Accepts both:
 * - tt:if="{{count > 0}}"
 * - tt:if="count > 0"
 */
function extractDirectivesFromProps(props) {
  const outProps = { ...props };
  const directives = {};

  for (const attr in COND_ATTRS) {
    if (outProps[attr] != null) {
      const kind = COND_ATTRS[attr];
      const raw = outProps[attr];

      delete outProps[attr];

      if (kind === "else") {
        directives.cond = { kind: "else" };
      } else {
        const expr = normalizeExpr(raw);
        const fn = compileExpr(expr);

        directives.cond = {
          kind,
          expr,
          fn,
        };
      }

      // Only one of conditional directives is allowed per element
      break;
    }
  }

  return { props: outProps, directives };
}

/**
 * Transform AST to IR
 * @param {object} node AST node from parse()
 * @returns {object} transformed node
 */
export function transform(node) {
  if (!node) return null;

  if (node.kind === "text") {
    return {
      kind: "text",
      parts: splitTextParts(node.value),
    };
  }

  if (node.kind === "element") {
    const { props, directives } = extractDirectivesFromProps(node.props || {});
    const children = (node.children || []).map(transform).filter(Boolean);

    const out = {
      kind: "element",
      tag: node.tag,
      props,
      children,
    };

    if (directives.cond) out.directives = directives;

    return out;
  }

  // root node is not expected as input here
  if (node.kind === "root") {
    return {
      kind: "root",
      children: (node.children || []).map(transform).filter(Boolean),
    };
  }

  throw new Error(`Unknown AST node kind: ${node.kind}`);
}