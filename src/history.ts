import * as ClipboardItem from './clipboardItem.js';
// Imported for their side effect: each subclass registers itself with the base
// factory used by setItems() below.
import './clipboardItemText.js';
import './clipboardItemImage.js';

export class History {
    private _history: Map<number, ClipboardItem.ClipboardItem>;

    constructor() {
        this._history = new Map();
    }

    public clear() {
        this._history.clear();
    }

    public delete(id: number) {
        this._history.delete(id);
    }

    public contains(id: number): boolean {
        return this._history.has(id);
    }

    public get(id: number): ClipboardItem.ClipboardItem | undefined {
        return this._history.get(id);
    }

    public add(item: ClipboardItem.ClipboardItem): boolean {
        if (this._history.has(item.id)) {
            // Re-copying an existing entry moves it back to the top of the
            // history instead of creating a duplicate.
            const existing = this._history.get(item.id)!;
            existing.copiedAt = Date.now();
            return false;
        }
        this._history.set(item.id, item);
        return true;
    }

    // Returns the items it dropped, so the caller can release what they own
    // (an image item has a file on disk).
    public trim(total: number): Array<ClipboardItem.ClipboardItem> {
        const removed: Array<ClipboardItem.ClipboardItem> = [];
        if (total <= 0) {
            return removed;
        }

        // getSorted() puts pinned items first, then the most recently copied ones,
        // so everything from `total` onwards is the oldest overflow.
        const arr = this.getSorted();
        for (let i = total; i < arr.length; ++i) {
            const item = arr[i];
            if (item.pinned) {
                continue;
            }
            this._history.delete(item.id);
            removed.push(item);
        }
        return removed;
    }

    public items(only_pinned: boolean): Array<ClipboardItem.ClipboardItem> {
        const items: any = [];
        this._history.forEach((item, _) => {
            if (only_pinned) {
                if (item.pinned) {
                    items.push(item);
                }
            } else {
                items.push(item);
            }
        });

        return items;
    }

    public getItems(): Array<ClipboardItem.ClipboardItem> {
        return Array.from(this._history.values());
    }

    public setItems(items: Array<any>) {
        this._history.clear();
        items.forEach((i) => {
            const item = ClipboardItem.ClipboardItem.fromJSON(i);
            this._history.set(item.id, item);
        });
    }

    // Pinned items first, then most recently copied.
    public getSorted(): Array<ClipboardItem.ClipboardItem> {
        const arr = Array.from(this._history.values());
        arr.sort((l: ClipboardItem.ClipboardItem, r: ClipboardItem.ClipboardItem): number => {
            if (r.pinned && !l.pinned) {
                return 1;
            }

            if (!r.pinned && l.pinned) {
                return -1;
            }

            return r.copiedAt - l.copiedAt;
        });

        return arr;
    }
}
