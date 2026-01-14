/**
 * Inline suggestion decorator
 */

import * as vscode from 'vscode';
import { DecorationOptions, Range, TextEditor } from 'vscode';

export class InlineDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  private decorationTypeDark: vscode.TextEditorDecorationType;
  private decorationTypeHighContrast: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = this.createDecorationType(
      'rgba(255, 200, 0, 0.1)',
      'rgba(255, 200, 0, 0.3)'
    );
    this.decorationTypeDark = this.createDecorationType(
      'rgba(255, 200, 0, 0.15)',
      'rgba(255, 200, 0, 0.4)'
    );
    this.decorationTypeHighContrast = this.createDecorationType(
      'rgba(255, 200, 0, 0.2)',
      'rgba(255, 200, 0, 0.5)'
    );
  }

  /**
   * Create decoration type
   */
  private createDecorationType(
    backgroundColor: string,
    borderColor: string
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '3px',
      overviewRulerColor: borderColor,
      overviewRulerLane: vscode.OverviewRulerLane.Full,
      before: {
        contentText: ' ',
        backgroundColor: borderColor,
        margin: '0 0 0 -3px'
      }
    });
  }

  /**
   * Apply decoration to editor
   */
  applyDecoration(
    editor: TextEditor,
    range: Range,
    hoverMessage?: string
  ): void {
    const decoration: DecorationOptions = {
      range,
      hoverMessage
    };

    const activeType = this.getDecorationType();
    editor.setDecorations(activeType, [decoration]);
  }

  /**
   * Apply multiple decorations
   */
  applyDecorations(
    editor: TextEditor,
    decorations: Array<{ range: Range; hoverMessage?: string }>
  ): void {
    const activeType = this.getDecorationType();
    const decorationOptions: DecorationOptions[] = decorations.map(d => ({
      range: d.range,
      hoverMessage: d.hoverMessage
    }));
    editor.setDecorations(activeType, decorationOptions);
  }

  /**
   * Clear decorations from editor
   */
  clearDecorations(editor?: TextEditor): void {
    if (editor) {
      editor.setDecorations(this.decorationType, []);
      editor.setDecorations(this.decorationTypeDark, []);
      editor.setDecorations(this.decorationTypeHighContrast, []);
    } else {
      vscode.window.visibleTextEditors.forEach(e => {
        e.setDecorations(this.decorationType, []);
        e.setDecorations(this.decorationTypeDark, []);
        e.setDecorations(this.decorationTypeHighContrast, []);
      });
    }
  }

  /**
   * Get appropriate decoration type based on theme
   */
  private getDecorationType(): vscode.TextEditorDecorationType {
    const kind = vscode.ColorThemeKind;
    const currentKind = vscode.window.activeColorTheme.kind;

    if (currentKind === kind.Light) {
      return this.decorationType;
    } else if (currentKind === kind.Dark) {
      return this.decorationTypeDark;
    } else {
      return this.decorationTypeHighContrast;
    }
  }

  /**
   * Dispose of decorations
   */
  dispose(): void {
    this.decorationType.dispose();
    this.decorationTypeDark.dispose();
    this.decorationTypeHighContrast.dispose();
  }
}
