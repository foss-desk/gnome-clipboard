import * as ClipboardItem from './clipboardItem.js';
// Imported for their side effect: each subclass registers itself with the base
// factory used by setItems() below.
import './clipboardItemText.js';
import './clipboardItemImage.js';

// Timestamps on a ClipboardItem that history can be ordered by.
export type HistorySortKey = 'copiedAt' | 'usedAt';

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
    // Pinned items are never dropped. The menu shows items by `copiedAt`, but
    // eviction is by `usedAt`: entries you keep re-copying survive even as
    // fresh copies keep arriving. getSorted('usedAt') puts pinned items first,
    // so everything from `total` onwards is the unpinned overflow to drop.
    public trim(total: number): Array<ClipboardItem.ClipboardItem> {
        const removed: Array<ClipboardItem.ClipboardItem> = [];
        if (total <= 0) {
            return removed;
        }

        const arr = this.getSorted('usedAt');
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

    // Pinned items first, then most recent first by the given timestamp.
    // Defaults to `copiedAt` so callers that show history get copy order;
    // pass 'usedAt' to order by last use instead (see trim()).
    public getSorted(by: HistorySortKey = 'copiedAt'): Array<ClipboardItem.ClipboardItem> {
        const arr = Array.from(this._history.values());
        arr.sort((l: ClipboardItem.ClipboardItem, r: ClipboardItem.ClipboardItem): number => {
            if (r.pinned && !l.pinned) {
                return 1;
            }

            if (!r.pinned && l.pinned) {
                return -1;
            }

            return r[by] - l[by];
        });

        return arr;
    }
}
