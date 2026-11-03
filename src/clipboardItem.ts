import * as utils from './utils.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export enum ClipboardItemType {
    TEXT,
    IMAGE
}

// Image files are content-addressed: new ones are named `<md5>.png`, while
// files written before the storage refactor kept the numeric hash as the
// filename. Recover the same numeric id in both cases so selection, dedupe and
// next/prev keep working for old and new history entries alike.
function imageID(path: string): number {
  const name = path.slice(path.lastIndexOf('/') + 1);

  const legacy = name.match(/^(-?\d+)\.png$/);
  if (legacy) {
    return Number(legacy[1]);
  }

  const contentHash = name.match(/^([0-9a-f]{32})\.png$/i);
  if (contentHash) {
    return utils.hashCode(contentHash[1]);
  }

  return utils.hashCode(path);
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
