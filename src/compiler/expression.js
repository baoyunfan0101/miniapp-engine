// src/compiler/expression.js
// Expression string -> fn(scope) => value
// scope: { data, ...data, item, index, ... }

const exprCache = new Map();

/**
 * Normalize expr: strip surrounding {{ }} if present.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeExpr(raw) {
  const s = String(raw ?? "");
  const m = s.match(/^\s*\{\{\s*([\s\S]+?)\s*\}\}\s*$/);
  return (m ? m[1] : s).trim();
}

/**
 * Safety belt: basic checks to prevent obviously unsafe expressions.
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
 * Compile expr -> function(scope) { with(scope) return (expr) }
 * @param {string} rawExpr expression string, can be "count>0" or "{{count>0}}"
 * @returns {(scope: any) => any}
 */
export function compileExpr(rawExpr) {
  const expr = normalizeExpr(rawExpr);
  if (!expr) {
    // Empty expression returns undefined
    return () => undefined;
  }

  if (exprCache.has(expr)) return exprCache.get(expr);

  assertSafeExpr(expr);

  // Using `with` allows `count` to resolve to scope.count (like Vue2).
  const fn = new Function(
    "scope",
    `
      try {
        with (scope) {
          return (${expr});
        }
      } catch (e) {
        // Re-throw with better context
        throw new Error("ExprError: " + ${JSON.stringify(expr)} + " -> " + e.message);
      }
    `
  );

  exprCache.set(expr, fn);
  return fn;
}