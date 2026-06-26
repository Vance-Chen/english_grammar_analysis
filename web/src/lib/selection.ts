/**
 * 在元素内将 Selection 转为相对根元素的 UTF-16 码元偏移 [start, end)。
 * 仅统计根内「属于句子正文」的文本节点，与 React state 中的 `text` 字符串下标一致。
 *
 * 须忽略：标注删除按钮等 UI 内的文本节点（否则会多计码元，导致选区整体右移/截断）。
 */
function isUiChromeTextNode(node: Text, root: HTMLElement): boolean {
  const p = node.parentElement;
  if (!p || !root.contains(p)) return false;
  return Boolean(p.closest("button.annot-chip__remove"));
}

export function selectionUtf16Offsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let start: number | null = null;
  let end: number | null = null;

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.nodeValue ?? "";
    const len = text.length;
    if (isUiChromeTextNode(node, root)) {
      continue;
    }
    if (node === range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      start = acc + range.startOffset;
    }
    if (node === range.endContainer && range.endContainer.nodeType === Node.TEXT_NODE) {
      end = acc + range.endOffset;
    }
    acc += len;
  }

  if (start == null || end == null) return null;
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  if (a === b) return null;
  return { start: a, end: b };
}

/** 选区在视口中的包围盒（用于弹层定位）；无选区或与 root 无关时返回 null */
export function getSelectionViewportRect(root: HTMLElement): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return null;
  if (!root.contains(range.commonAncestorContainer)) return null;
  const rects = range.getClientRects();
  if (rects.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
