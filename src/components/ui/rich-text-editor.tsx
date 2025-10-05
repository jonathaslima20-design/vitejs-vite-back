import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichTextEditorProps) {
  const handleChange = useCallback((content: string) => {
    console.log('Rich text editor content change:', content.length, 'characters');
    onChange(content);
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2],
        },
      }),
      Underline,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[150px]',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      handleChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/50">
        <div className="items-center justify-center flex flex-wrap gap-1">
          <button
            type="button"
            onClick={(e) => handleButtonClick(e, () => editor.chain().focus().toggleBold().run())}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-2.5 hover:bg-muted hover:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              editor.isActive('bold') ? "bg-accent text-accent-foreground" : "bg-transparent"
            )}
            aria-label="Negrito"
          >
            <Bold className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => handleButtonClick(e, () => editor.chain().focus().toggleItalic().run())}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-2.5 hover:bg-muted hover:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              editor.isActive('italic') ? "bg-accent text-accent-foreground" : "bg-transparent"
            )}
            aria-label="Itálico"
          >
            <Italic className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => handleButtonClick(e, () => editor.chain().focus().toggleUnderline().run())}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-2.5 hover:bg-muted hover:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              editor.isActive('underline') ? "bg-accent text-accent-foreground" : "bg-transparent"
            )}
            aria-label="Sublinhado"
          >
            <UnderlineIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => handleButtonClick(e, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-2.5 hover:bg-muted hover:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              editor.isActive('heading', { level: 2 }) ? "bg-accent text-accent-foreground" : "bg-transparent"
            )}
            aria-label="Título"
          >
            <Heading2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => handleButtonClick(e, () => editor.chain().focus().toggleBulletList().run())}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-2.5 hover:bg-muted hover:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              editor.isActive('bulletList') ? "bg-accent text-accent-foreground" : "bg-transparent"
            )}
            aria-label="Lista"
          >
            <List className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => handleButtonClick(e, () => editor.chain().focus().toggleOrderedList().run())}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "h-9 px-2.5 hover:bg-muted hover:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              editor.isActive('orderedList') ? "bg-accent text-accent-foreground" : "bg-transparent"
            )}
            aria-label="Lista Numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}