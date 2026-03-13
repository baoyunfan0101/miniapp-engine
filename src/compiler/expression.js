/**
 * src/compiler/expression.js
 * Expression string -> JavaScript source string
 */

/**
 * Normalize an expression string.
 * If the input is wrapped by {{ }}, unwrap it.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeExpr(raw) {
  const source = String(raw ?? "");
  const match = source.match(/^\s*\{\{\s*([\s\S]+?)\s*\}\}\s*$/);
  return (match ? match[1] : source).trim();
}

/**
 * Assert that an expression is safe to embed in generated render code.
 * This is a minimal safety layer for template expressions.
 * @param {string} expr
 */
function assertSafeExpr(expr) {
  // Disallow statements / declarations and obvious dangerous globals.
  const banned = /\b(?:new|function|class|this|window|document|globalThis|eval|Function|import|export)\b/;
  if (banned.test(expr)) {
    throw new Error(`Unsafe expression (banned token): ${expr}`);
  }

  // Disallow statement separators that are often used for injection.
  if (/[;{}]/.test(expr)) {
    throw new Error(`Unsafe expression (banned chars): ${expr}`);
  }
}

/**
 * Generate a safe JavaScript expression source string.
 * Example:
 *   "count + 1" -> "(count + 1)"
 *   "{{ count + 1 }}" -> "(count + 1)"
 * @param {string} rawExpr
 * @returns {string}
 */
export function genExprSource(rawExpr) {
  const expr = normalizeExpr(rawExpr);

  if (!expr) {
    return "undefined";
  }

  assertSafeExpr(expr);
  return `(${expr})`;
}