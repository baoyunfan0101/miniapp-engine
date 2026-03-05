// src/compiler/index.js
// template (DSL string) -> IR (transformed AST)

import { parse } from "./parse.js";
import { transform } from "./transform.js";

/**
 * Compile template string into IR (transformed AST).
 * @param {string} template
 * @returns {object} IR root node (kind: "element")
 */
export function compile(template) {
  const ast = parse(template);
  const ir = transform(ast);
  return ir;
}