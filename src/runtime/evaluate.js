// src/runtime/evaluate.js
// IR (transformed AST) + data(scope) -> vDOM

/**
 * vDOM node shapes:
 * - TextNode: { type: "#text", value: string }
 * - Element:  { type: "view" | "text" | "button", props: {}, children: [] , ... }
 */

function mapTagToType(tag) {
  if (tag === "view") return "view";
  if (tag === "text") return "text";
  if (tag === "button") return "button";
  throw new Error(`Unknown tag <${tag}>`);
}

/* Create the evaluation scope for expressions. */
function createScope(data, extra = {}) {
  // both `count` and `data.count` resolve
  return { data, ...(data || {}), ...extra };
}

/* Evaluate text.parts into a final string */
function evalTextParts(parts, scope) {
  let out = "";
  for (const p of parts || []) {
    if (!p) continue;

    if (p.kind === "static") {
      out += p.value ?? "";
      continue;
    }

    if (p.kind === "expr") {
      try {
        const v = p.fn(scope);
        out += v == null ? "" : String(v);
      } catch (e) {
        // In dev you may want to throw; in runtime you can choose to degrade.
        // For now, degrade to empty string with a helpful error.
        console.error(`[ExprError] ${p.expr}`, e);
        out += "";
      }
      continue;
    }

    throw new Error(`Unknown text part kind: ${p.kind}`);
  }
  return out;
}

function getCond(node) {
  return node && node.kind === "element" ? node.directives?.cond : null;
}

function isIfNode(node) {
  const c = getCond(node);
  return c && c.kind === "if";
}

function isElifNode(node) {
  const c = getCond(node);
  return c && c.kind === "elif";
}

function isElseNode(node) {
  const c = getCond(node);
  return c && c.kind === "else";
}

function evalCondPass(cond, scope) {
  if (!cond) return true;
  if (cond.kind === "else") return true;
  // if / elif
  return Boolean(cond.fn(scope));
}

/**
 * Evaluate an array of sibling nodes with correct if/elif/else chain semantics.
 * - elif/else only apply when they directly follow an if/elif chain.
 */
function evaluateChildren(children, scope) {
  const out = [];
  const list = children || [];

  for (let i = 0; i < list.length; i++) {
    const cur = list[i];

    // Start of a cond-chain: tt:if
    if (isIfNode(cur)) {
      let chosen = null;

      // if
      const ifCond = getCond(cur);
      if (evalCondPass(ifCond, scope)) {
        chosen = cur;
      }

      // consume subsequent elif/else siblings
      let j = i + 1;
      while (j < list.length) {
        const n = list[j];

        if (isElifNode(n)) {
          if (!chosen) {
            const elifCond = getCond(n);
            if (evalCondPass(elifCond, scope)) chosen = n;
          }
          j++;
          continue;
        }

        if (isElseNode(n)) {
          if (!chosen) chosen = n;
          j++;
          break; // else ends the chain
        }

        break; // chain ends
      }

      // Render only the chosen branch (if any)
      if (chosen) {
        const vnode = evaluateNode(chosen, scope, { skipCond: true });
        if (vnode) out.push(vnode);
      }

      // Skip the whole chain
      i = j - 1;
      continue;
    }

    // Ignore stray elif/else
    const vnode = evaluateNode(cur, scope);
    if (vnode) out.push(vnode);
  }

  return out;
}

/**
 * Evaluate IR node to vDOM.
 * @param {object} node transformed node
 * @param {object} scope evaluation scope
 * @param {object} [opts]
 * @param {boolean} [opts.skipCond] when true, do not apply node.directives.cond filtering
 * @returns {object|null} vnode or null
 */
function evaluateNode(node, scope, opts = {}) {
  if (!node) return null;

  // #text (innerHTML): { kind:"text", parts:[...] }
  if (node.kind === "text") {
    return {
      type: "#text",
      value: evalTextParts(node.parts, scope),
    };
  }

  if (node.kind !== "element") {
    throw new Error(`Unsupported node kind in evaluate: ${node.kind}`);
  }

  // directives (tt:if / tt:elif / tt:else)
  if (!opts.skipCond) {
    const cond = node.directives?.cond;
    if (cond) {
      if (cond.kind === "if" || cond.kind === "elif") {
        const pass = Boolean(cond.fn(scope));
        if (!pass) return null;
      } else if (cond.kind === "else") {
        // Standalone else: pass
      }
    }
  }

  const type = mapTagToType(node.tag);

  // props
  const props = { ...node.props };

  // events
  let event = undefined;
  if (type === "button" && props.bindtap) {
    // add bindtap to event field
    event = props.bindtap;
    // remove bindtap from props to avoid setting it as a HTML attribute
    delete props.bindtap;
  }

  // children
  const children = evaluateChildren(node.children || [], scope);

  const vnode = { type, props, children };

  if (type === "button") vnode.event = event;

  return vnode;
}

/**
 * Entry: evaluate IR root with plain data object.
 * @param {object} irRoot transformed root element
 * @param {object} data runtime data
 * @param {object} extraScope extra variables (future: { item, index })
 */
export function evaluate(irRoot, data, extraScope = {}) {
  const scope = createScope(data, extraScope);
  return evaluateNode(irRoot, scope);
}