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
            const existing = this._history.get(item.id)!;
            existing.updateLastUsed();
            return false;
        }
        this._history.set(item.id, item);
        return true;
    }

    // Returns the items it dropped, so the caller can release what they own
    // (an image item has a file on disk).
    //
    // Pinned items are never dropped. Among the rest, the least recently used
    // entries go first: the menu keeps showing items by `copiedAt`, but eviction
    // is by `usedAt`, so entries you keep re-copying survive even as fresh
    // copies keep arriving.
    public trim(total: number): Array<ClipboardItem.ClipboardItem> {
        const removed: Array<ClipboardItem.ClipboardItem> = [];
        if (total <= 0) {
            return removed;
        }

        const unpinned: Array<ClipboardItem.ClipboardItem> = [];
        let pinnedCount = 0;
        this._history.forEach((item) => {
            if (item.pinned) {
                pinnedCount++;
            } else {
                unpinned.push(item);
            }
        });

        // Most recently used first, so the tail is the overflow to evict.
        unpinned.sort((l, r) => r.usedAt - l.usedAt);

        const keep = Math.max(0, total - pinnedCount);
        for (let i = keep; i < unpinned.length; ++i) {
            const item = unpinned[i];
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
