// Tiptap editor entry — bundled by scripts/build-editor.mjs (esbuild) and
// inlined into the editor HTML so the editor works fully offline. Do not load
// these modules from a CDN; that breaks the app's local-first guarantee.

import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { format } from 'date-fns';

import {
  formatRelativeDisplayDate,
  parseDates,
} from '../../../../lib/dateParser';

const lowlight = createLowlight(common);

// ── Date detection (runs in the editor so all positions are ProseMirror
// document positions — never mixed with markdown string offsets) ──

// Dismissed dates are keyed by text + resolved timestamp so the key is stable
// regardless of position/coordinate space.
const dismissedDateKeys = new Set();
const dateKey = match => `${match.text}:${match.date.getTime()}`;

const dateLabel = match => {
  const base = Date.now();
  const hasTime =
    match.date.getHours() !== 0 ||
    match.date.getMinutes() !== 0 ||
    match.date.getSeconds() !== 0;
  const dateText = formatRelativeDisplayDate(match.date, base);
  return hasTime ? `${dateText} ${format(match.date, 'HH:mm')}` : dateText;
};

// Parse a single text node and return matches with positions relative to it.
const matchesInNode = nodeText => parseDates(nodeText, Date.now());

function getDecorations(doc) {
  const decorations = [];
  const presentKeys = new Set();
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      matchesInNode(node.text).forEach(match => {
        const key = dateKey(match);
        presentKeys.add(key);
        if (dismissedDateKeys.has(key)) {
          return;
        }
        decorations.push(
          Decoration.inline(
            pos + match.index,
            pos + match.index + match.length,
            { class: 'date-highlight' },
          ),
        );
      });
    }
  });
  // Drop dismissals for dates no longer present so re-typing the same date
  // (after deleting it) highlights again.
  dismissedDateKeys.forEach(key => {
    if (!presentKeys.has(key)) {
      dismissedDateKeys.delete(key);
    }
  });
  return DecorationSet.create(doc, decorations);
}

const DateHighlightExtension = Extension.create({
  name: 'dateHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('dateHighlight'),
        state: {
          init(_, { doc }) {
            return getDecorations(doc);
          },
          apply(tr, old) {
            return tr.docChanged || tr.getMeta('refreshDates')
              ? getDecorations(tr.doc)
              : old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// Find the (non-dismissed) date under a collapsed cursor and report it to RN so
// the banner doesn't depend on RN recomputing positions from the markdown text.
function computeFocusedDate(editor) {
  const { from, to, $from } = editor.state.selection;
  if (from !== to) {
    return null;
  }

  // Only parse the block the cursor sits in (cheap), and work in that block's
  // text-content coordinates — offset relative to the parent's content start.
  const parentText = $from.parent.textContent;
  if (!parentText) {
    return null;
  }
  const offset = from - $from.start();

  let focused = null;
  matchesInNode(parentText).forEach(match => {
    if (
      offset >= match.index &&
      offset <= match.index + match.length &&
      !dismissedDateKeys.has(dateKey(match))
    ) {
      focused = { key: dateKey(match), label: dateLabel(match), text: match.text };
    }
  });

  return focused;
}

function sendFocusedDate(editor) {
  postToRN({ type: 'focusedDate', focusedDate: computeFocusedDate(editor) });
}

function refreshDateDecorations(editor) {
  editor.view.dispatch(editor.state.tr.setMeta('refreshDates', true));
}

// ── Post message to React Native ──
function postToRN(payload) {
  try {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  } catch (e) {
    /* silently fail */
  }
}

// ── Debounce utility ──
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Ambient Idle Chunking ──
const triggerAmbientIdle = debounce((editor) => {
  const { $from } = editor.state.selection;
  const chunk = $from ? $from.parent.textContent : '';
  if (chunk && chunk.trim().length >= 2) {
    postToRN({ type: 'ambient_idle', chunk: chunk.trim() });
  }
}, 3000);

// ── Report which toolbar commands are active for the current selection ──
function getActiveState(editor) {
  return {
    h1: editor.isActive('heading', { level: 1 }),
    h2: editor.isActive('heading', { level: 2 }),
    h3: editor.isActive('heading', { level: 3 }),
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    strike: editor.isActive('strike'),
    inlineCode: editor.isActive('code'),
    link: editor.isActive('link'),
    bullet: editor.isActive('bulletList'),
    number: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    quote: editor.isActive('blockquote'),
    codeBlock: editor.isActive('codeBlock'),
  };
}

function updateToolbarState(active) {
  document.querySelectorAll('[data-command]').forEach((button) => {
    const command = button.getAttribute('data-command');
    const isActive = Boolean(active[command]);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function postActiveState(editor) {
  const active = getActiveState(editor);
  updateToolbarState(active);
  postToRN({
    type: 'active',
    active,
    linkHref: editor.getAttributes('link').href || null,
  });
}

// ── Init Tiptap Editor ──
const editor = new Editor({
  element: document.getElementById('editor'),
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced by CodeBlockLowlight below for syntax highlighting.
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Image.configure({ allowBase64: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer' },
    }),
    Placeholder.configure({
      placeholder:
        '빠르게 적고, 날짜 표현은 일정 후보로 감지됩니다.\n내일 10시 회의, 26.03.06 회고, 목요일 운동',
    }),
    Markdown.configure({
      html: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    DateHighlightExtension,
  ],
  editorProps: {
    attributes: {
      class: 'tiptap',
    },
  },
  onUpdate: debounce(({ editor }) => {
    const markdown = editor.storage.markdown.getMarkdown();
    postToRN({ type: 'update', markdown });
    postActiveState(editor);
    sendFocusedDate(editor);
    triggerAmbientIdle(editor);
  }, 500),
  onSelectionUpdate({ editor }) {
    const { from, to } = editor.state.selection;
    const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
    postToRN({ type: 'selection', selectedText, from, to });
    postActiveState(editor);
    sendFocusedDate(editor);
    triggerAmbientIdle(editor);
  },
  onFocus() {
    postToRN({ type: 'focus' });
  },
  onBlur() {
    // Flush the latest content immediately on blur. onUpdate is debounced
    // (500ms), so a quick action right after typing — pressing "새 메모",
    // switching panes/tabs — would otherwise drop text still inside the
    // debounce window, and the memo would never reach the store/sidebar.
    const markdown = editor.storage.markdown.getMarkdown();
    postToRN({ type: 'update', markdown });
    postToRN({ type: 'blur' });
  },
});

// Set by bindToolbar so the (possibly hidden) link popover can be opened from
// an external toolbar command.
let openLinkPopoverFn = null;

function applyEditorCommand(command, args) {
  const chain = editor.chain().focus();
  switch (command) {
    case 'h1':
      chain.toggleHeading({ level: 1 }).run();
      break;
    case 'h2':
      chain.toggleHeading({ level: 2 }).run();
      break;
    case 'h3':
      chain.toggleHeading({ level: 3 }).run();
      break;
    case 'bold':
      chain.toggleBold().run();
      break;
    case 'italic':
      chain.toggleItalic().run();
      break;
    case 'strike':
      chain.toggleStrike().run();
      break;
    case 'inlineCode':
      chain.toggleCode().run();
      break;
    case 'link':
      if (args && args.href) {
        chain.extendMarkRange('link').setLink({ href: args.href }).run();
      } else if (openLinkPopoverFn) {
        openLinkPopoverFn();
      } else {
        chain.run();
      }
      break;
    case 'unsetLink':
      chain.extendMarkRange('link').unsetLink().run();
      break;
    case 'image':
      if (args && args.src) {
        chain.setImage({ src: args.src, alt: args.alt || '' }).run();
      } else {
        chain.run();
      }
      break;
    case 'bullet':
      chain.toggleBulletList().run();
      break;
    case 'number':
      chain.toggleOrderedList().run();
      break;
    case 'quote':
      chain.toggleBlockquote().run();
      break;
    case 'codeBlock':
      chain.toggleCodeBlock().run();
      break;
    case 'taskList':
      chain.toggleTaskList().run();
      break;
    case 'horizontalRule':
      chain.setHorizontalRule().run();
      break;
    case 'dismissDate': {
      const key = args && args.key;
      if (key) {
        dismissedDateKeys.add(key);
        refreshDateDecorations(editor);
        sendFocusedDate(editor);
      }
      break;
    }
    case 'insertText': {
      const token = (args && args.text) || '';
      if (!token) {
        break;
      }
      // Insert at the real cursor with context-aware spacing.
      const { from } = editor.state.selection;
      const before =
        from > 0 ? editor.state.doc.textBetween(Math.max(0, from - 1), from) : '';
      const after = editor.state.doc.textBetween(
        from,
        Math.min(editor.state.doc.content.size, from + 1),
      );
      const lead = before && !/\s/.test(before) ? ' ' : '';
      const trail = after && !/\s/.test(after) ? ' ' : '';
      chain.insertContent(`${lead}${token}${trail}`).run();
      break;
    }
    default:
      break;
  }

  // Reflect the new state on the toolbar immediately (onUpdate is debounced).
  postActiveState(editor);
}

function bindToolbar(editor) {
  const toolbar = document.getElementById('editor-toolbar');
  const urlPopover = document.getElementById('url-popover');
  const urlInput = document.getElementById('url-input');
  const urlApply = document.getElementById('url-apply');
  const urlRemove = document.getElementById('url-remove');
  const urlCancel = document.getElementById('url-cancel');
  let urlKind = null;

  function closeUrlPopover() {
    urlKind = null;
    urlPopover?.classList.remove('is-open');
  }

  function openUrlPopover(kind) {
    urlKind = kind;
    if (urlInput) {
      urlInput.value = kind === 'link' ? editor.getAttributes('link').href || 'https://' : 'https://';
    }
    if (urlRemove) {
      urlRemove.style.display = kind === 'link' && editor.isActive('link') ? '' : 'none';
    }
    urlPopover?.classList.add('is-open');
    setTimeout(() => urlInput?.focus(), 0);
  }

  openLinkPopoverFn = () => openUrlPopover('link');

  function applyUrlPopover() {
    const value = urlInput?.value.trim();
    if (!value) {
      closeUrlPopover();
      return;
    }

    if (urlKind === 'image') {
      applyEditorCommand('image', { src: value });
    } else {
      applyEditorCommand('link', { href: value });
    }
    closeUrlPopover();
  }

  // Keep the editor's text selection intact when a toolbar button is pressed.
  // Without this, mousedown moves focus out of the contenteditable and the
  // selection collapses before the command runs, so inline commands
  // (bold/italic/…) apply to the wrong range and block commands (h1/quote/…)
  // act on the whole current block — making every button feel like an
  // apply-all / clear-all toggle.
  toolbar?.addEventListener('mousedown', (event) => {
    if (event.target.closest('[data-command]')) {
      event.preventDefault();
    }
  });

  toolbar?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-command]');
    if (!button) return;

    const command = button.getAttribute('data-command');
    if (!command) return;

    if (button.dataset.urlKind) {
      openUrlPopover(button.dataset.urlKind);
      return;
    }

    closeUrlPopover();
    applyEditorCommand(command);
  });

  urlApply?.addEventListener('click', applyUrlPopover);
  urlRemove?.addEventListener('click', () => {
    applyEditorCommand('unsetLink');
    closeUrlPopover();
  });
  urlCancel?.addEventListener('click', closeUrlPopover);
  urlInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyUrlPopover();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeUrlPopover();
    }
  });

  postActiveState(editor);
}

// ── Commands callable from React Native ──
window.editorSetContent = function (markdown) {
  if (!markdown && markdown !== '') return;
  editor.commands.setContent(markdown);
  postActiveState(editor);
};

window.editorApplyCommand = function (command, args) {
  applyEditorCommand(command, args);
};

// Hide the in-editor toolbar when an external (React Native) toolbar drives
// formatting — used by the macOS split panes' shared top toolbar.
window.editorSetToolbarVisible = function (visible) {
  const toolbar = document.getElementById('editor-toolbar');
  if (toolbar) {
    toolbar.style.display = visible ? '' : 'none';
  }
};

window.editorFocus = function () {
  editor.commands.focus();
};

window.editorGetMarkdown = function () {
  return editor.storage.markdown.getMarkdown();
};

bindToolbar(editor);

// ── Signal ready ──
postToRN({ type: 'ready' });
