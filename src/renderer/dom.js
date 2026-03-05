// src/renderer/dom.js
// DOM ops

import { MSG } from "../shared/protocol.js";

/**
 * Set properties to a DOM element.
 * @param {HTMLElement} el
 * @param {object} props
 */
export function setProps(el, props = {}) {
  for (const key of Object.keys(props)) {
    // treat null/undefined as removal
    const value = props[key];
    if (value == null) continue;

    if (key === "class") {
      el.className = value;
    } else if (key === "style") {
      el.style.cssText = "";
      const v = value;
      if (v && typeof v === "object") Object.assign(el.style, v);
      else el.style.cssText = v ?? "";
    } else {
      el.setAttribute(key, value);
    }
  }
}

/**
 * Patch element properties (diff old/new).
 * @param {HTMLElement} el
 * @param {object} oldProps
 * @param {object} newProps
 */
export function patchProps(el, oldProps = {}, newProps = {}) {
  // update & add
  for (const key of Object.keys(newProps)) {
    if (oldProps[key] !== newProps[key]) {
      if (newProps[key] == null) {
        // treat null/undefined as removal
        if (key === "class") el.className = "";
        else if (key === "style") el.style.cssText = "";
        else el.removeAttribute(key);
      } else {
        setProps(el, { [key]: newProps[key] });
      }
    }
  }

  // remove
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      if (key === "class") el.className = "";
      else if (key === "style") el.style.cssText = "";
      else el.removeAttribute(key);
    }
  }
}

/**
 * Bind events based on vnode.
 * @param {HTMLElement} el
 * @param {object} vnode
 * @param {Worker} worker
 */
export function bindEvents(el, vnode, worker) {
  if (vnode.type === "button") {
    if (vnode.event) {
      el.onclick = () => worker.postMessage({ type: MSG.EVENT, name: vnode.event, payload: {} });
    } else {
      el.onclick = null;
    }
  }
}

/**
 * Create DOM node from vnode, and set vnode.el.
 * - #text => Text
 * - view => div
 * - text => span
 * - button => button
 *
 * @param {object} vnode
 * @param {Worker} worker worker in charge of the vnode
 * @returns {Node} DOM node
 */
export function createEl(vnode, worker) {
  let el;

  // #text (innerHTML)
  if (vnode.type === "#text") {
    el = document.createTextNode(vnode.value ?? "");
    vnode.el = el;
    return el;
  }

  if (vnode.type === "view") {
    el = document.createElement("div");
  } else if (vnode.type === "text") {
    el = document.createElement("span");
  } else if (vnode.type === "button") {
    el = document.createElement("button");
    bindEvents(el, vnode, worker);
  } else {
    el = document.createElement("div");
  }

  setProps(el, vnode.props);

  // link the vnode to its corresponding DOM element
  vnode.el = el;
  return el;
}