// ─── MarkdownEditor (true WYSIWYG) ──────────────────────────────────
//
// Install:
//   npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image \
//               @tiptap/extension-placeholder
//
// In tools.tsx, add these imports at the top:
//
//   import { useEditor, EditorContent } from "@tiptap/react";
//   import StarterKit from "@tiptap/starter-kit";
//   import Image from "@tiptap/extension-image";
//   import Placeholder from "@tiptap/extension-placeholder";
//
// Then paste the component (everything below) before `export const tools`.
// The tools/toolNames exports already reference MarkdownEditor, so no
// further changes are needed.
// ─────────────────────────────────────────────────────────────────────

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { AnnotationEditorProps } from "./App";
import React, { useRef } from "react";




/* ── helper ─────────────────────────────────────────────────────────── */

function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ── toolbar button ─────────────────────────────────────────────────── */

const TBButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, active, title, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => {
      e.preventDefault(); // keep editor focus
      onClick();
    }}
    style={{
      padding: "2px 6px",
      fontSize: 13,
      fontFamily: "Poppins, sans-serif",
      border: "1px solid #ccc",
      borderRadius: 3,
      background: active ? "#e0e0e0" : "#fafafa",
      cursor: "pointer",
      lineHeight: 1.4,
    }}
  >
    {children}
  </button>
);

/* ── component ──────────────────────────────────────────────────────── */

const MarkdownNote: React.FC<AnnotationEditorProps> = (props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder: "Write your note here…" }),
    ],
    content: props.value.metadata.markdownContent ?? "",
    onUpdate: ({ editor }) => {
      props.utils.setMetadata({ markdownContent: editor.getHTML() });
    },
    editorProps: {
      // ── paste images from clipboard ──
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
              readFileAsDataURL(blob).then((src) => {
                view.dispatch(
                  view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({ src })
                  )
                );
              });
            }
            return true;
          }
        }
        return false;
      },
      // ── drop images from desktop / file manager ──
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (!file.type.startsWith("image/")) return false;

        event.preventDefault();
        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        readFileAsDataURL(file).then((src) => {
          const node = view.state.schema.nodes.image.create({ src });
          if (coords) {
            view.dispatch(view.state.tr.insert(coords.pos, node));
          } else {
            view.dispatch(view.state.tr.replaceSelectionWith(node));
          }
        });

        return true;
      },
    },
  });

  const insertImageFromFile = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      const src = await readFileAsDataURL(file);
      editor.chain().focus().setImage({ src }).run();
      e.target.value = "";
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* ── toolbar ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          padding: "4px 0 6px",
          borderBottom: "1px solid #ddd",
          marginBottom: 6,
        }}
      >
        <TBButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <b>B</b>
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <i>I</i>
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <s>S</s>
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          {"</>"}
        </TBButton>

        <span style={{ borderLeft: "1px solid #ccc", margin: "0 2px" }} />

        <TBButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading"
        >
          H
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          •&thinsp;list
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered list"
        >
          1.&thinsp;list
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          &ldquo;&thinsp;&rdquo;
        </TBButton>
        <TBButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code block"
        >
          {"{ }"}
        </TBButton>

        <span style={{ borderLeft: "1px solid #ccc", margin: "0 2px" }} />

        <TBButton onClick={() => fileInputRef.current?.click()} title="Upload image">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Image
          </span>
        </TBButton>
      </div>

      {/* ── editor surface ── */}
      <EditorContent
        editor={editor}
        style={{
          minHeight: 180,
          maxHeight: 400,
          overflowY: "auto",
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: 8,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      />

      {/* hidden file input for the Image toolbar button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={insertImageFromFile}
        style={{ display: "none" }}
      />

      {/* ── inline styles for the Tiptap content area ── */}
      <style>{`
        .tiptap {
          outline: none;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #aaa;
          pointer-events: none;
          height: 0;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 6px 0;
        }
        .tiptap pre {
          background: #f4f4f4;
          padding: 8px 12px;
          border-radius: 4px;
          overflow-x: auto;
        }
        .tiptap blockquote {
          border-left: 3px solid #ccc;
          padding-left: 10px;
          margin-left: 0;
          color: #555;
        }
        .tiptap code {
          background: #f0f0f0;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
};

export default MarkdownNote;