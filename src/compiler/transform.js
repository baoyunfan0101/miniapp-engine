/**
 * src/compiler/transform.js
 * AST -> IR
 *
 * IR node shapes:
 * - Root:
 *   { kind: "root", children: IrNode[] }
 *
 * - Element:
 *   {
 *     kind: "element",
 *     tag: string,
 *     component: boolean,
 *     props: Array<
 *       { kind: "static", name: string, value: any } |
 *       { kind: "dynamic", name: string, expr: string }
 *     >,
 *     event: null | { name: string, handler: string },
 *     directives: Array<
 *       { name: "if" | "elif" | "else", expr?: string } |
 *       { name: string, arg?: string | null, expr?: string | null }
 *     >,
 *     children: IrNode[]
 *   }
 *
 * - Text:
 *   {
 *     kind: "text",
 *     parts: Array<
 *       { kind: "static", value: string } |
 *       { kind: "expr", expr: string }
 *     >
 *   }
 */

import { normalizeExpr } from "./expression.js";

/**
 * Determine whether a tag should be treated as a custom component.
 * Current rule:
 * - built-in tags: view / text / button
 * - others: component
 * @param {string} tag
 * @returns {boolean}
 */
function isComponentTag(tag) {
  return !["view", "text", "button"].includes(tag);
}

/**
 * Normalize one AST prop node into IR buckets.
 * @param {object} prop
 * @param {Array<object>} outProps
 * @param {{ current: object | null }} eventRef
 * @param {Array<object>} directives
 */
function normalizePropNode(prop, outProps, eventRef, directives) {
  if (!prop) return;

  if (prop.kind === "attr") {
    outProps.push({
      kind: "static",
      name: prop.name,
      value: prop.value,
    });
    return;
  }

  if (prop.kind !== "directive") {
    throw new Error(`Unknown AST prop kind: ${prop.kind}`);
  }

  if (prop.name === "bind") {
    outProps.push({
      kind: "dynamic",
      name: prop.arg,
      expr: normalizeExpr(prop.exp),
    });
    return;
  }

  if (prop.name === "on") {
    eventRef.current = {
      name: prop.arg,
      handler: String(prop.exp ?? ""),
    };
    return;
  }

  if (prop.name === "if" || prop.name === "elif") {
    directives.push({
      name: prop.name,
      expr: normalizeExpr(prop.exp),
    });
    return;
  }

  if (prop.name === "else") {
    directives.push({
      name: "else",
    });
    return;
  }

  // keep unknown directives as structured metadata.
  directives.push({
    name: prop.name,
    arg: prop.arg ?? null,
    expr: prop.exp ?? null,
  });
}

/**
 * Merge adjacent text-like AST nodes into one IR text node.
 * Example:
 *   [text("a "), interp("b"), text(" c")]
 * -> text(parts=[static("a "), expr("b"), static(" c")])
 * @param {object[]} nodes
 * @param {number} start
 * @returns {{ node: object, nextIndex: number }}
 */
function mergeTextLikeNodes(nodes, start) {
  const parts = [];
  let i = start;

  while (i < nodes.length) {
    const node = nodes[i];

    if (node.kind === "text") {
      parts.push({
        kind: "static",
        value: node.content,
      });
      i++;
      continue;
    }

    if (node.kind === "interp") {
      parts.push({
        kind: "expr",
        expr: normalizeExpr(node.content),
      });
      i++;
      continue;
    }

    break;
  }

  return {
    node: {
      kind: "text",
      parts,
    },
    nextIndex: i,
  };
}

/**
 * Transform semantic AST children into codegen-ready IR children.
 * Adjacent text / interpolation nodes are merged here.
 * @param {object[]} children
 * @returns {object[]}
 */
function transformChildren(children) {
  const out = [];
  const list = children || [];

  for (let i = 0; i < list.length; ) {
    const node = list[i];

    if (node.kind === "text" || node.kind === "interp") {
      const merged = mergeTextLikeNodes(list, i);
      out.push(merged.node);
      i = merged.nextIndex;
      continue;
    }

    out.push(transform(node));
    i++;
  }

  return out.filter(Boolean);
}

/**
 * Transform a semantic AST node into a codegen-ready IR node.
 * @param {object} node
 * @returns {object | null}
 */
export function transform(node) {
  if (!node) return null;

  if (node.kind === "root") {
    return {
      kind: "root",
      children: transformChildren(node.children || []),
    };
  }

  if (node.kind === "text") {
    return {
      kind: "text",
      parts: [{ kind: "static", value: node.content }],
    };
  }

  if (node.kind === "interp") {
    return {
      kind: "text",
      parts: [{ kind: "expr", expr: normalizeExpr(node.content) }],
    };
  }

  if (node.kind === "element") {
    const props = [];
    const directives = [];
    const eventRef = { current: null };

    for (const prop of node.props || []) {
      normalizePropNode(prop, props, eventRef, directives);
    }

    return {
      kind: "element",
      tag: node.tag,
      component: isComponentTag(node.tag),
      props,
      event: eventRef.current,
      directives,
      children: transformChildren(node.children || []),
    };
  }

  throw new Error(`Unknown AST node kind: ${node.kind}`);
}