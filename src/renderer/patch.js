/**
 * src/renderer/patch.js
 * old vnode -> new vnode
 */

import { mount } from "./mount.js";
import { patchProps, bindEvents, normalizeChildren } from "./dom.js";

/**
 * Replace one old vnode subtree with a new vnode subtree.
 * @param {object} oldVnode
 * @param {object} newVnode
 * @param {Worker} worker
 * @returns {void}
 */
function replaceNode(oldVnode, newVnode, worker) {
  const parent = oldVnode?.el?.parentNode;
  if (!parent) {
    return;
  }

  const anchor = oldVnode.el.nextSibling;
  oldVnode.el.remove();

  mount(newVnode, parent, worker);

  if (newVnode?.el && anchor) {
    parent.insertBefore(newVnode.el, anchor);
  }
}

/**
 * Patch one old vnode so that it matches the new vnode.
 * @param {object} oldVnode
 * @param {object} newVnode
 * @param {Worker} worker
 * @returns {void}
 */
export function patch(oldVnode, newVnode, worker) {
  if (oldVnode.type !== newVnode.type) {
    replaceNode(oldVnode, newVnode, worker);
    return;
  }

  const el = (newVnode.el = oldVnode.el);

  if (newVnode.type === "#text") {
    if (oldVnode.value !== newVnode.value) {
      el.nodeValue = newVnode.value ?? "";
    }
    return;
  }

  patchProps(el, oldVnode.props || {}, newVnode.props || {});
  bindEvents(el, newVnode, worker);

  const oldChildren = normalizeChildren(oldVnode.children);
  const newChildren = normalizeChildren(newVnode.children);

  const commonLength = Math.min(oldChildren.length, newChildren.length);

  for (let i = 0; i < commonLength; i++) {
    patch(oldChildren[i], newChildren[i], worker);
  }

  for (let i = commonLength; i < newChildren.length; i++) {
    mount(newChildren[i], el, worker);
  }

  for (let i = commonLength; i < oldChildren.length; i++) {
    oldChildren[i].el?.remove();
  }
}