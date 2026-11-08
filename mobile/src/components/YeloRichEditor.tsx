import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface YeloRichEditorRef {
  setContent: (html: string) => void;
  applyFormat: (format: string, value?: string) => void;
  getHtml: () => string;
  getPlainText: () => string;
  focus: () => void;
}

interface YeloRichEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange?: (html: string, plainText: string) => void;
  onFocus?: () => void;
  minHeight?: number;
}

const EDITOR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background-color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #333333;
    }
    #editor {
      width: 100%;
      min-height: 220px;
      padding: 14px;
      outline: none;
      word-break: break-word;
    }
    #editor:empty:before {
      content: attr(data-placeholder);
      color: #9ca3af;
      pointer-events: none;
      display: block;
    }
    h1, h2 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1B4332;
      margin: 14px 0 6px 0;
    }
    h3, h4 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #1B4332;
      margin: 12px 0 4px 0;
    }
    p {
      margin: 0 0 10px 0;
    }
    ul, ol {
      margin: 6px 0 10px 0;
      padding-left: 24px;
    }
    li {
      margin-bottom: 4px;
    }
    b, strong {
      font-weight: 700;
      color: #111827;
    }
    i, em {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    s, strike {
      text-decoration: line-through;
    }
    a {
      color: #1B4332;
      text-decoration: underline;
    }
    blockquote {
      border-left: 3px solid #1B4332;
      margin: 8px 0;
      padding-left: 12px;
      color: #555555;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div id="editor" contenteditable="true" data-placeholder="Comece a escrever seu post aqui..."></div>

  <script>
    const editor = document.getElementById('editor');
    let savedRange = null;

    function saveSelection() {
      const sel = window.getSelection();
      if (sel.getRangeAt && sel.rangeCount) {
        savedRange = sel.getRangeAt(0);
      }
    }

    function restoreSelection() {
      if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }

    document.addEventListener('selectionchange', saveSelection);

    function notifyChange() {
      const html = editor.innerHTML;
      const text = (editor.innerText || '').trim();
      const height = Math.max(document.body.scrollHeight, editor.scrollHeight, 220);

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONTENT_CHANGE',
          html: html,
          text: text,
          height: height
        }));
      }
    }

    editor.addEventListener('input', notifyChange);
    editor.addEventListener('keyup', notifyChange);
    editor.addEventListener('paste', function() {
      setTimeout(notifyChange, 50);
    });
    editor.addEventListener('focus', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FOCUS' }));
      }
    });

    function normalizeHtml(raw) {
      if (!raw) return '';
      let str = String(raw).trim();
      if (/<[a-z][\\s\\S]*>/i.test(str)) {
        return str;
      }
      str = str
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')
        .replace(/\\*\\*(.*?)\\*\\*/gim, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/gim, '<em>$1</em>')
        .replace(/__(.*?)__/gim, '<u>$1</u>')
        .replace(/~~(.*?)~~/gim, '<s>$1</s>')
        .replace(/\\n\\n+/g, '</p><p>')
        .replace(/\\n/g, '<br/>');
      return '<p>' + str + '</p>';
    }

    function setContent(html) {
      editor.innerHTML = normalizeHtml(html);
      notifyChange();
    }

    function execCmd(command, value) {
      editor.focus();
      restoreSelection();
      if (command === 'formatBlock') {
        document.execCommand(command, false, value || '<p>');
      } else if (command === 'createLink') {
        const url = prompt('Digite o endereço do link (URL):', value || 'https://');
        if (url && url !== 'https://') {
          document.execCommand('createLink', false, url);
        }
      } else if (command === 'removeFormat') {
        document.execCommand('removeFormat', false, null);
        document.execCommand('formatBlock', false, '<p>');
      } else {
        document.execCommand(command, false, value || null);
      }
      saveSelection();
      notifyChange();
    }

    window.addEventListener('DOMContentLoaded', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
      }
    });
  </script>
</body>
</html>
`;

export const YeloRichEditor = forwardRef<YeloRichEditorRef, YeloRichEditorProps>(
  (
    {
      initialContent = '',
      placeholder = 'Comece a escrever seu post aqui...',
      onChange,
      onFocus,
      minHeight = 240,
    },
    ref
  ) => {
    const webviewRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [editorHeight, setEditorHeight] = useState(minHeight);

    const currentHtmlRef = useRef<string>(initialContent);
    const currentTextRef = useRef<string>('');
    const pendingContentRef = useRef<string | null>(initialContent || null);

    const injectContent = (html: string) => {
      const sanitized = JSON.stringify(html || '');
      webviewRef.current?.injectJavaScript(`setContent(${sanitized}); true;`);
    };

    useImperativeHandle(ref, () => ({
      setContent: (html: string) => {
        currentHtmlRef.current = html;
        if (isReady) {
          injectContent(html);
        } else {
          pendingContentRef.current = html;
        }
      },
      applyFormat: (format: string, value?: string) => {
        let js = '';
        switch (format) {
          case 'bold':
            js = "execCmd('bold'); true;";
            break;
          case 'italic':
            js = "execCmd('italic'); true;";
            break;
          case 'underline':
            js = "execCmd('underline'); true;";
            break;
          case 'strike':
            js = "execCmd('strikeThrough'); true;";
            break;
          case 'h2':
            js = "execCmd('formatBlock', '<h2>'); true;";
            break;
          case 'h3':
            js = "execCmd('formatBlock', '<h3>'); true;";
            break;
          case 'p':
          case 'normal':
            js = "execCmd('formatBlock', '<p>'); true;";
            break;
          case 'bullet':
            js = "execCmd('insertUnorderedList'); true;";
            break;
          case 'number':
            js = "execCmd('insertOrderedList'); true;";
            break;
          case 'link':
            js = "execCmd('createLink'); true;";
            break;
          case 'clean':
            js = "execCmd('removeFormat'); true;";
            break;
          default:
            if (value) {
              js = `execCmd(${JSON.stringify(format)}, ${JSON.stringify(value)}); true;`;
            } else {
              js = `execCmd(${JSON.stringify(format)}); true;`;
            }
            break;
        }
        webviewRef.current?.injectJavaScript(js);
      },
      getHtml: () => currentHtmlRef.current,
      getPlainText: () => currentTextRef.current,
      focus: () => {
        webviewRef.current?.injectJavaScript('editor.focus(); true;');
      },
    }));

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'READY') {
          setIsReady(true);
          if (placeholder) {
            webviewRef.current?.injectJavaScript(
              `editor.setAttribute('data-placeholder', ${JSON.stringify(placeholder)}); true;`
            );
          }
          if (pendingContentRef.current !== null) {
            injectContent(pendingContentRef.current);
            pendingContentRef.current = null;
          }
        } else if (data.type === 'CONTENT_CHANGE') {
          currentHtmlRef.current = data.html;
          currentTextRef.current = data.text;
          if (data.height && Math.abs(data.height - editorHeight) > 12) {
            setEditorHeight(Math.max(data.height + 14, minHeight));
          }
          onChange?.(data.html, data.text);
        } else if (data.type === 'FOCUS') {
          onFocus?.();
        }
      } catch (err) {
        // ignore
      }
    };

    const WebViewComponent = WebView as any;

    return (
      <View style={[styles.container, { height: editorHeight }]}>
        <WebViewComponent
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: EDITOR_HTML }}
          onMessage={handleMessage}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          style={styles.webview}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          hideKeyboardAccessoryView={true}
          keyboardDisplayRequiresUserAction={false}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  webview: {
    backgroundColor: '#ffffff',
    width: '100%',
    height: '100%',
  },
});

export default YeloRichEditor;
