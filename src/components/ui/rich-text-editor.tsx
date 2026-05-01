"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Link as LinkIcon,
  Undo,
  Redo,
  Code,
  Quote,
  Heading2,
  Heading3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePromptDialog } from "@/hooks/usePromptDialog";

// ============================================================================
// Types
// ============================================================================

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  minHeight?: string;
  maxHeight?: string;
  disabled?: boolean;
  showToolbar?: boolean;
  toolbarVariant?: "full" | "minimal";
}

// ============================================================================
// Toolbar Button
// ============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  tooltip,
  children,
}: ToolbarButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-8 w-8 p-0 text-white/60 hover:bg-white/10 hover:text-white",
              isActive && "bg-white/10 text-indigo-300"
            )}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-zinc-900 text-white text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Toolbar Separator
// ============================================================================

function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px bg-white/10" />;
}

// ============================================================================
// Editor Toolbar
// ============================================================================

interface EditorToolbarProps {
  editor: Editor | null;
  variant: "full" | "minimal";
}

function EditorToolbar({ editor, variant }: EditorToolbarProps) {
  const { prompt, promptDialog } = usePromptDialog();

  const setLink = React.useCallback(async () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = await prompt({
      title: "Set link",
      inputLabel: "URL",
      placeholder: "https://example.com",
      defaultValue: previousUrl,
      confirmLabel: "Apply link",
    });

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, prompt]);

  if (!editor) return null;

  return (
    <>
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-white/10 bg-white/5 px-2 py-1.5">
      {/* History */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        tooltip="Undo"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        tooltip="Redo"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        tooltip="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        tooltip="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        tooltip="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        tooltip="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        tooltip="Highlight"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      {variant === "full" && (
        <>
          <ToolbarSeparator />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            tooltip="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            tooltip="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        tooltip="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        tooltip="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      {variant === "full" && (
        <>
          <ToolbarSeparator />

          {/* Alignment */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            isActive={editor.isActive({ textAlign: "left" })}
            tooltip="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            isActive={editor.isActive({ textAlign: "center" })}
            tooltip="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            isActive={editor.isActive({ textAlign: "right" })}
            tooltip="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* Block elements */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            tooltip="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive("codeBlock")}
            tooltip="Code Block"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* Link */}
          <ToolbarButton
            onClick={setLink}
            isActive={editor.isActive("link")}
            tooltip="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}
    </div>
    {promptDialog}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
  editorClassName,
  minHeight = "120px",
  maxHeight = "400px",
  disabled = false,
  showToolbar = true,
  toolbarVariant = "minimal",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-indigo-300 underline hover:text-indigo-200",
        },
      }),
    ],
    content: value,
    editable: !disabled,
    // Prevent SSR hydration mismatches in Next.js
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert prose-sm max-w-none focus:outline-none",
          "prose-headings:text-white prose-headings:font-semibold",
          "prose-p:text-white/80 prose-p:leading-relaxed",
          "prose-strong:text-white prose-em:text-white/80",
          "prose-ul:text-white/80 prose-ol:text-white/80",
          "prose-li:text-white/80 prose-li:marker:text-white/50",
          "prose-blockquote:border-l-indigo-400 prose-blockquote:text-white/60",
          "prose-code:text-indigo-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded",
          "prose-pre:bg-white/5 prose-pre:text-white/80",
          "prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline",
          editorClassName
        ),
      },
    },
  });

  // Update editor content when value changes externally
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  // Update editable state when disabled changes
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-colors",
        "focus-within:border-indigo-400/50 focus-within:ring-1 focus-within:ring-indigo-400/30",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {showToolbar && <EditorToolbar editor={editor} variant={toolbarVariant} />}
      <div
        className="px-3 py-2 overflow-y-auto"
        style={{ minHeight, maxHeight }}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "min-h-full",
            "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.is-editor-empty:first-child::before]:text-white/30",
            "[&_.is-editor-empty:first-child::before]:float-left",
            "[&_.is-editor-empty:first-child::before]:pointer-events-none",
            "[&_.is-editor-empty:first-child::before]:h-0"
          )}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Compact variant for smaller fields
// ============================================================================

interface CompactRichTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CompactRichText({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: CompactRichTextProps) {
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      showToolbar={true}
      toolbarVariant="minimal"
      minHeight="80px"
      maxHeight="200px"
    />
  );
}

// ============================================================================
// Plain text extraction helper
// ============================================================================

export function extractPlainText(html: string): string {
  if (typeof window === "undefined") {
    // Server-side: simple regex-based extraction
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Client-side: use DOM
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}
