// src/renderer/patch.js
// Update DOM: old vnode -> new vnode

import { mount } from "./mount.js";
import { patchProps, bindEvents } from "./dom.js";

/**
 * Patch old vnode to match new vnode (in-place).
 * @param {object} oldVnode
 * @param {object} newVnode
 * @param {Worker} worker
 */
export function patch(oldVnode, newVnode, worker) {
  // if the type of the node has changed, re-mount the whole subtree
  // considering the case that newVnode.type === "view"
  if (oldVnode.type !== newVnode.type) {
    // record the parent and new sibling of the old node
    const parent = oldVnode.el.parentNode;
    if (!parent) return;
    const anchor = oldVnode.el.nextSibling;
    oldVnode.el.remove();

    // mount the whole subtree to a temporary container
    const temp = document.createDocumentFragment();
    mount(newVnode, temp, worker);

    // mount the new node to the correct position
    parent.insertBefore(temp, anchor);
    return;
  }

  const el = (newVnode.el = oldVnode.el);

  // #text (innerHTML)
  if (newVnode.type === "#text") {
    if (oldVnode.value !== newVnode.value) {
      el.nodeValue = newVnode.value ?? "";
    }
    return;
  }

  // update props
  patchProps(el, oldVnode.props || {}, newVnode.props || {});

  // update children
  const oldChildren = oldVnode.children || [];
  const newChildren = newVnode.children || [];

  const commonLen = Math.min(oldChildren.length, newChildren.length);

  for (let i = 0; i < commonLen; i++) {
    patch(oldChildren[i], newChildren[i], worker);
  }

  for (let i = commonLen; i < newChildren.length; i++) {
    mount(newChildren[i], el, worker);
  }

  for (let i = commonLen; i < oldChildren.length; i++) {
    oldChildren[i].el.remove();
  }

  // re-bind events for button
  if (newVnode.type === "button") bindEvents(el, newVnode, worker);

  return;
}