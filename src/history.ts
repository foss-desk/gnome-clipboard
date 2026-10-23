import * as ClipboardItem from './clipboardItem.js';
import * as Settings from './settings.js';

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

  public get(id: number): ClipboardItem.ClipboardItem | undefined {
    return this._history.get(id);
  }

  public set(item: ClipboardItem.ClipboardItem) {
    return this._history.set(item.id(), item);
  }

  public add(item: ClipboardItem.ClipboardItem): boolean {
    if (this._history.has(item.id())) {
        let existing = this._history.get(item.id())!;
        existing.usage++;
        existing.usedAt = Date.now();
        return true;
    }
    this._history.set(item.id(), item);
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
    let arr = this.getSorted(Settings.HISTORY_SORT_COPY_TIME);
    for (let i = total; i < arr.length; ++i) {
      let item = arr[i];
      if (item.pinned) {
        continue;
      }
      this._history.delete(item.id());
      removed.push(item);
    }
    return removed;
  }

  public items(only_pinned: boolean): Array<ClipboardItem.ClipboardItem> {
    let items: any = [];
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
    items.forEach(i => {
      let item = new ClipboardItem.ClipboardItem(i.text, i.usage, i.pinned, i.copiedAt, i.usedAt, i.type, i.imagePath);
      this._history.set(item.id(), item);
    });
  }

  public getSorted(sort_by: number): Array<ClipboardItem.ClipboardItem> {
    let arr = Array.from(this._history.values());
    arr.sort((l: ClipboardItem.ClipboardItem, r: ClipboardItem.ClipboardItem): number => {
      if (r.pinned && !l.pinned) {
        return 1;
      }

      if (!r.pinned && l.pinned) {
        return -1;
      }

      switch (sort_by) {
        case Settings.HISTORY_SORT_RECENT_USAGE:
          return r.usedAt - l.usedAt;

        case Settings.HISTORY_SORT_COPY_TIME:
          return r.copiedAt - l.copiedAt;

        case Settings.HISTORY_SORT_MOST_USAGE:
        default:
          if (r.usage == l.usage) {
            return r.copiedAt - l.copiedAt;
          }
          return r.usage - l.usage;
      }
    });

    return arr;
  }
}