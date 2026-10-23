import * as utils from './utils.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export enum ClipboardItemType {
    TEXT,
    IMAGE
}

// Store.saveImage() names the file `<id>.png`, where <id> is the hash of the
// image bytes -- the same value ClipboardPanel tracks as the current selection.
// Recover it from the filename so an image item's id() matches that selection;
// hashing the path instead produced an id nothing else in the extension ever
// computes, so an image was never highlighted and next/prev went dead after
// copying one.
function imageID(path: string): number {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const match = name.match(/^(-?\d+)\.png$/);
  return match ? Number(match[1]) : utils.hashCode(path);
}

export class ClipboardItem {
    public text: string;
    public usage: number;
    public pinned: boolean;
    public copiedAt: number;
    public usedAt: number;
    public type: ClipboardItemType;
    public imagePath: string | null;

    // id() hashes the full item text and is called once per item on every menu
    // rebuild (plus once per probe in lookups). The identity of an item never
    // changes after construction, so compute it lazily and keep it.
    private _id: number | null = null;

    constructor(text: string, usage: number, pinned: boolean, copiedAt: number, usedAt: number, 
                type: ClipboardItemType = ClipboardItemType.TEXT, imagePath: string | null = null) {
      this.text = text;
      this.usage = usage;
      this.pinned = pinned;
      this.copiedAt = copiedAt;
      this.usedAt = usedAt;
      this.type = type;
      this.imagePath = imagePath;
    }

    public id(): number {
      if (this._id === null) {
        this._id = (this.type === ClipboardItemType.IMAGE && this.imagePath)
          ? imageID(this.imagePath)
          : utils.hashCode(this.text);
      }
      return this._id;
    }

    public display(): string {
      if (this.type === ClipboardItemType.IMAGE) {
        return _("[Image]");
      }
      return utils.truncate(this.text, 32);
    }

    public updateLastUsed() {
      this.usage++;
      this.usedAt = Date.now();
    }
  }
