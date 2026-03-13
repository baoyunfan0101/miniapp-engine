/**
 * src/renderer/index.js
 * vDOM -> DOM
 */

import { mount } from "./mount.js";
import { patch } from "./patch.js";

/** @type {object | null} */
let prevTree = null;

/**
 * Check whether a value is a valid vnode shape.
 * Current supported vnode shapes:
 * - Text:
 *   { type: "#text", value: any, el?: Node }
 *
 * - Element:
 *   {
 *     type: string,
 *     props?: object,
 *     children?: Array<object | null>,
 *     event?: string,
 *     component?: boolean,
 *     el?: Node
 *   }
 *
 * @param {object | null} vnode
 */
function assertVnode(vnode) {
  if (!vnode || typeof vnode !== "object") {
    throw new Error("Invalid vnode: root must be an object");
  }

  if (typeof vnode.type !== "string" || !vnode.type) {
    throw new Error("Invalid vnode: missing type");
  }

  if (vnode.type === "#text") {
    if ("children" in vnode && vnode.children != null) {
      throw new Error("Invalid vnode: #text must not have children");
    }
    return;
  }

  if ("children" in vnode && vnode.children != null && !Array.isArray(vnode.children)) {
    throw new Error("Invalid vnode: children must be an array");
  }
}

/**
 * Render a vnode tree into a root container.
 * On first render, mount the whole tree.
 * On later renders, patch the previous tree in place.
 *
 * @param {object} tree
 * @param {HTMLElement} root
 * @param {Worker} worker
 */
export function render(tree, root, worker) {
  assertVnode(tree);

  if (!prevTree) {
    root.innerHTML = "";
    mount(tree, root, worker);
    prevTree = tree;
    return;
  }

  patch(prevTree, tree, worker);
  prevTree = tree;
}