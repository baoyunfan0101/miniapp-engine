// src/renderer/index.js
// vDOM -> DOM

import { MSG } from "../shared/protocol.js";

function assertVnode(v) {
  if (!v || typeof v !== "object") throw new Error("Invalid vnode: not an object");
  if (!v.type) throw new Error("Invalid vnode: missing type");
  if (v.type === "view" && v.children && !Array.isArray(v.children)) {
    throw new Error("Invalid vnode: view.children must be array");
  }
}

let prevTree = null;

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

// set properties to a DOM element
function setProps(el, props = {}) {
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

// vnode: { type: "view" | "text" | "button", ... }
// worker: worker in charge of the vnode
function createEl(vnode, worker) {
  let el;

  if (vnode.type === "view") {
    el = document.createElement("div");
  } else if (vnode.type === "text") {
    el = document.createElement("span");
    el.textContent = vnode.value ?? "";
  } else if (vnode.type === "button") {
    el = document.createElement("button");
    el.textContent = vnode.text ?? "";
    el.onclick = () => {
      worker.postMessage({ type: MSG.EVENT, name: vnode.event, payload: {} });
    };
  } else {
    el = document.createElement("div");
  }

  setProps(el, vnode.props);

  // link the vnode to its corresponding DOM element
  vnode.el = el;
  return el;
}

// recursively create DOM elements
function mount(vnode, container, worker) {
  const el = createEl(vnode, worker);

  if (vnode.type === "view") {
    for (const child of vnode.children || []) {
      mount(child, el, worker);
    }
  }

  container.appendChild(el);
}

// update properties of a DOM element
function patchProps(el, oldProps = {}, newProps = {}) {
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

// update DOM elements
function patch(oldVnode, newVnode, worker) {
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
    parent.insertBefore(temp.firstChild, anchor);
    return;
  }

  const el = (newVnode.el = oldVnode.el);

  if (newVnode.type === "text") {
    if (oldVnode.value !== newVnode.value) {
      el.textContent = newVnode.value ?? "";
    }

    patchProps(el, oldVnode.props || {}, newVnode.props || {});
    return;
  }

  if (newVnode.type === "button") {
    if (oldVnode.text !== newVnode.text) {
      el.textContent = newVnode.text ?? "";
    }
    el.onclick = () => {
      worker.postMessage({ type: MSG.EVENT, name: newVnode.event, payload: {} });
    };

    patchProps(el, oldVnode.props || {}, newVnode.props || {});
    return;
  }

  if (newVnode.type === "view") {
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

    patchProps(el, oldVnode.props || {}, newVnode.props || {});
    return;
  }
}