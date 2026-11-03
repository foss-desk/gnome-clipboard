import * as utils from './utils.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export enum ClipboardItemType {
    TEXT,
    IMAGE
}

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
