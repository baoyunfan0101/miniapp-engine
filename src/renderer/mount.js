// src/renderer/mount.js
// Initial mount: vnode -> DOM subtree

import { createEl } from "./dom.js";

/**
 * Recursively mount vnode into container.
 * @param {object} vnode
 * @param {Node} container
 * @param {Worker} worker
 */
export function mount(vnode, container, worker) {
  const el = createEl(vnode, worker);

  if (vnode.type !== "#text") {
    for (const child of vnode.children || []) {
      mount(child, el, worker);
    }
  }

  container.appendChild(el);
}