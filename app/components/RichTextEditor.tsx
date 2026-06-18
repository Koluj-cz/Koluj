"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function RichTextEditor({
  value,
  onChange,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--koluj-border)] bg-white">
      <div className="flex gap-2 border-b border-[var(--koluj-border)] p-3">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="rounded-lg px-3 py-1 font-bold hover:bg-[var(--koluj-bg)]"
        >
          B
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="rounded-lg px-3 py-1 italic hover:bg-[var(--koluj-bg)]"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => {
            const url = prompt("Zadej odkaz");

            if (!url) return;

            editor
              .chain()
              .focus()
              .setLink({ href: url })
              .run();
          }}
          className="rounded-lg px-3 py-1 hover:bg-[var(--koluj-bg)]"
        >
          🔗
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          className="rounded-lg px-3 py-1 hover:bg-[var(--koluj-bg)]"
        >
          •
        </button>
      </div>

      <EditorContent
        editor={editor}
        className="min-h-[180px] p-4"
      />
    </div>
  );
}