"use client";

import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";

/**
 * Standart `@tiptap/extension-image` üzerine `width` (piksel) özniteliği ve
 * sürükleyerek boyutlandırma (resize handle) ekler — görev #190: görsel
 * ekleme önceden yalnızca URL ile mümkündü ve hiçbir şekilde
 * boyutlandırılamıyordu. Yeni bir npm paketi EKLENMEDEN, projede zaten
 * kurulu olan @tiptap/react'in ReactNodeViewRenderer'ı ile uygulanmıştır.
 *
 * Bilinçli basitleştirme: yalnızca GENİŞLİK saklanır, yükseklik "auto"
 * bırakılır (en/boy oranı korunur) — farklı ekran genişliklerinde bozulan
 * bir yükseklik değeri saklamaktan kaçınmak için.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = attributes.width;
          return width ? { style: `width: ${width}px` } : {};
        },
        parseHTML: (element: HTMLElement) => {
          const style = element.style.width;
          if (!style) return null;
          const parsed = parseInt(style, 10);
          return Number.isNaN(parsed) ? null : parsed;
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

function ResizableImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!editor.isEditable) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = imgRef.current?.getBoundingClientRect().width ?? (node.attrs.width as number | null) ?? 320;
      setResizing(true);

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(60, Math.round(startWidth + delta));
        updateAttributes({ width: nextWidth });
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editor.isEditable, node.attrs.width, updateAttributes],
  );

  const width = node.attrs.width as number | null;

  return (
    <NodeViewWrapper
      as="span"
      className="ortak-alan-resizable-image"
      data-selected={selected || undefined}
      data-resizing={resizing || undefined}
      style={{ display: "inline-block", position: "relative", maxWidth: "100%", lineHeight: 0 }}
    >
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) || ""}
        title={(node.attrs.title as string) || undefined}
        style={{
          width: width ? `${width}px` : undefined,
          maxWidth: "100%",
          display: "block",
          borderRadius: "0.5rem",
          outline: selected ? "2px solid var(--primary)" : "none",
          outlineOffset: "2px",
        }}
        draggable={false}
      />
      {editor.isEditable && selected && (
        <span
          onPointerDown={startResize}
          className="ortak-alan-image-resize-handle"
          title="Sürükleyerek boyutlandır"
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 14,
            height: 14,
            borderRadius: "9999px",
            background: "var(--primary)",
            border: "2px solid var(--card)",
            cursor: "nwse-resize",
            touchAction: "none",
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
