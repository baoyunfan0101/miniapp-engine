/**
 * src/compiler/index.js
 * DSL -> AST -> IR -> JavaScript source code
 */

import { parse } from "./parse.js";
import { transform } from "./transform.js";
import { generate } from "./generate.js";

/**
 * Convert any runtime value to display text.
 * @param {any} value
 * @returns {string}
 */
function toDisplayString(value) {
  return value == null ? "" : String(value);
}

/**
 * Compile a DSL template into a render function.
 * @param {string} template
 * @returns {{
 *   ast: object,
 *   ir: object,
 *   code: string,
 *   render: (scope: object) => object
 * }}
 */
export function compile(template) {
  // parse template into semantic AST
  const ast = parse(template);

  // transform AST into codegen-ready IR
  const ir = transform(ast);

  // generate render function body source
  const { code } = generate(ir);

  // create the executable render function
  const rawRender = new Function("scope", "_toDisplayString", code);

  return {
    ast,
    ir,
    code,
    render(scope) {
      return rawRender(scope, toDisplayString);
    },
  };
}