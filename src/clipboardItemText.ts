import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as utils from './utils.js';
import { ClipboardItem, ClipboardItemType, Store } from './clipboardItem.js';
import type { ClipboardItemData } from './clipboardItem.js';

export class ClipboardItemText extends ClipboardItem {
    public readonly type = ClipboardItemType.TEXT;
    public readonly text: string;

    constructor(id: number, text: string) {
        super(id);
        this.text = text;
    }

    public notification(): string {
        return utils.truncate(this.text, 32);
    }

    public displayWidget(): any {
        const label = new St.Label({
            text: this.notification(),
            style_class: 'clipboard-item-text',
            x_align: Clutter.ActorAlign.START,
        });
        label.clutter_text.line_wrap = true;
        return label;
    }

    public searchText(): string {
        return this.text;
    }

    public copyToClipboard(): void {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, this.text);
    }

    public dispose(_store: Store): void {
        // Nothing to release: text lives only in memory and history.json.
    }

    public toJSON(): ClipboardItemData {
        return {
            type: this.type,
            id: this.id,
            text: this.text,
            pinned: this.pinned,
            copiedAt: this.copiedAt,
            usage: this.usage,
            usedAt: this.usedAt,
        };
    }

    public static fromJSON(raw: any): ClipboardItemText {
        const item = new ClipboardItemText(raw.id, raw.text);
        item.pinned = raw.pinned;
        item.copiedAt = raw.copiedAt;
        // History written before usage tracking lacks these fields.
        item.usage = raw.usage ?? 1;
        item.usedAt = raw.usedAt ?? raw.copiedAt;
        return item;
    }
}

ClipboardItem.registerType(ClipboardItemType.TEXT, ClipboardItemText.fromJSON);
