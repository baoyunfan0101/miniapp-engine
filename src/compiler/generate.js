/**
 * src/compiler/generate.js
 * IR -> JavaScript source code
 */

import { genExprSource } from "./expression.js";

/**
 * Generate render function body source code from IR.
 * The generated function signature is:
 *   render(scope, _toDisplayString)
 * @param {object} ir
 * @returns {{ code: string }}
 */
export function generate(ir) {
  const code = `
    with (scope) {
      return ${genNode(ir)};
    }
  `;

  return { code };
}

/**
 * Generate source code for an IR node.
 * @param {object} node
 * @returns {string}
 */
function genNode(node) {
  if (!node) return "null";

  if (node.kind === "root") {
    if ((node.children || []).length !== 1) {
      throw new Error("IR root must contain exactly one child");
    }
    return genNode(node.children[0]);
  }

  if (node.kind === "text") {
    return `{ type: "#text", value: ${genTextParts(node.parts)} }`;
  }

  if (node.kind === "element") {
    return genElement(node);
  }

  throw new Error(`Unknown IR node kind: ${node.kind}`);
}

/**
 * Generate source code for text parts.
 * Text interpolation uses _toDisplayString because text must end up as a string.
 * @param {Array<{ kind: string, value?: string, expr?: string }>} parts
 * @returns {string}
 */
function genTextParts(parts) {
  const segments = (parts || []).map((part) => {
    if (part.kind === "static") {
      return JSON.stringify(part.value ?? "");
    }

    if (part.kind === "expr") {
      return `_toDisplayString(${genExprSource(part.expr)})`;
    }

    throw new Error(`Unknown text part kind: ${part.kind}`);
  });

  return segments.length > 0 ? segments.join(" + ") : `""`;
}

/**
 * Generate source code for props.
 * Dynamic props keep their original runtime type.
 * @param {Array<object>} props
 * @returns {string}
 */
function genProps(props) {
  if (!props || props.length === 0) {
    return "{}";
  }

  const entries = props.map((prop) => {
    if (prop.kind === "static") {
      return `${JSON.stringify(prop.name)}: ${JSON.stringify(prop.value)}`;
    }

    if (prop.kind === "dynamic") {
      return `${JSON.stringify(prop.name)}: ${genExprSource(prop.expr)}`;
    }

    throw new Error(`Unsupported prop kind: ${prop.kind}`);
  });

  return `{ ${entries.join(", ")} }`;
}

/**
 * Get the conditional directive of an element node, if present.
 * @param {object} node
 * @returns {object | null}
 */
function getCondDirective(node) {
  if (node?.kind !== "element") return null;
  return (node.directives || []).find(
    (dir) => dir.name === "if" || dir.name === "elif" || dir.name === "else"
  ) || null;
}

/**
 * Generate source code for an element node.
 * @param {object} node
 * @returns {string}
 */
function genElement(node) {
  const extraFields = [];

  if (node.event) {
    extraFields.push(`event: ${JSON.stringify(node.event.handler)}`);
  }

  if (node.component) {
    extraFields.push(`component: true`);
  }

  const extra = extraFields.length > 0 ? `, ${extraFields.join(", ")}` : "";

  return `{
    type: ${JSON.stringify(node.tag)},
    props: ${genProps(node.props)},
    children: ${genChildren(node.children || [])}
    ${extra}
  }`;
}

/**
 * Generate source code for child nodes.
 * This function lowers if / elif / else chains.
 * @param {object[]} children
 * @returns {string}
 */
function genChildren(children) {
  const generated = [];
  const list = children || [];

  for (let i = 0; i < list.length; i++) {
    const current = list[i];
    const cond = getCondDirective(current);

    // lower a full conditional chain starting from tt:if
    if (cond?.name === "if") {
      const chain = [current];
      let j = i + 1;

      while (j < list.length) {
        const next = list[j];
        const nextCond = getCondDirective(next);

        if (nextCond?.name === "elif" || nextCond?.name === "else") {
          chain.push(next);
          j++;
          continue;
        }

        break;
      }

      generated.push(genCondChain(chain));
      i = j - 1;
      continue;
    }

    //ignore stray elif / else
    if (cond?.name === "elif" || cond?.name === "else") {
      continue;
    }

    // generate a normal child
    generated.push(genNode(current));
  }

  return `[${generated.join(", ")}]`;
}

/**
 * Generate source code for an if / elif / else chain.
 * @param {object[]} chain
 * @returns {string}
 */
function genCondChain(chain) {
  function build(index) {
    const node = chain[index];
    const cond = getCondDirective(node);

    if (!cond || cond.name === "else") {
      return genNodeWithoutCond(node);
    }

    const test = genExprSource(cond.expr);
    const consequent = genNodeWithoutCond(node);
    const alternate = index + 1 < chain.length ? build(index + 1) : "null";

    return `(${test} ? ${consequent} : ${alternate})`;
  }

  return build(0);
}

/**
 * Generate an element node while dropping its conditional directive wrapper.
 * Other directives are preserved for future extension.
 * @param {object} node
 * @returns {string}
 */
function genNodeWithoutCond(node) {
  if (node.kind !== "element") {
    return genNode(node);
  }

  return genElement({
    ...node,
    directives: (node.directives || []).filter(
      (dir) => dir.name !== "if" && dir.name !== "elif" && dir.name !== "else"
    ),
  });
}