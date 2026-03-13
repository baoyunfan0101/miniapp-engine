/**
 * src/renderer/mount.js
 * vnode -> DOM subtree
 */

import { createEl, normalizeChildren } from "./dom.js";

/**
 * Recursively mount a vnode into a container.
 * @param {object | null} vnode
 * @param {Node} container
 * @param {Worker} worker
 * @returns {void}
 */
export function mount(vnode, container, worker) {
  if (vnode == null) {
    return;
  }

  const el = createEl(vnode, worker);

  if (vnode.type !== "#text") {
    for (const child of normalizeChildren(vnode.children)) {
      mount(child, el, worker);
    }
  }

  container.appendChild(el);
}