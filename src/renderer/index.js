// src/renderer/index.js
// vDOM -> DOM

import { mount } from "./mount.js";
import { patch } from "./patch.js";

/** @type {any|null} */
let prevTree = null;

function assertVnode(v) {
  if (!v || typeof v !== "object") throw new Error("Invalid vnode: not an object");
  if (!v.type) throw new Error("Invalid vnode: missing type");

  if (v.type === "#text") {
    if ("children" in v && v.children != null) throw new Error("Invalid vnode: #text must not have children");
    return;
  }

  if (v.children != null && !Array.isArray(v.children)) {
    throw new Error("Invalid vnode: view.children must be array");
  }
}

/**
 * Render vDOM tree into root container.
 * @param {object} tree vnode root
 * @param {HTMLElement} root
 * @param {Worker} worker
 */
export function render(tree, root, worker) {
  assertVnode(tree);

  if (!prevTree) {
    // initial render: tree -> DOM
    root.innerHTML = "";
    mount(tree, root, worker);
    prevTree = tree;
  } else {
    // update DOM
    patch(prevTree, tree, worker);
    prevTree = tree;
  }
}