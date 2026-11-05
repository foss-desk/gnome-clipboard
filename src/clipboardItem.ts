export enum ClipboardItemType {
    TEXT,
    IMAGE,
}

// The slice of the storage layer an item needs to persist and release what it
// owns.
export interface Store {
    saveImage(id: number, bytes: GLib.Bytes): Promise<string | null>;
    deleteImage(imageName: string): void;
}

// On-disk / wire representation.
export interface ClipboardItemData {
    type: ClipboardItemType;
    id: number;
    text?: string;
    pinned: boolean;
    copiedAt: number;
}

type ClipboardItemFactory = (raw: any) => ClipboardItem;

export abstract class ClipboardItem {
    // The unique identity of this item, derived from its content.
    public readonly id: number;

    public pinned: boolean;
    public copiedAt: number;

    // Wire discriminator. Branch on `instanceof` for per-type behaviour.
    public abstract readonly type: ClipboardItemType;

    constructor(id: number) {
        this.id = id;
        this.pinned = false;
        this.copiedAt = Date.now();
    }

    public abstract notification(): string;

    // The text matched by the search box. Images have no user-visible text.
    public abstract searchText(): string;

    public abstract displayWidget(): any;

    // Put this item onto the system clipboard.
    public abstract copyToClipboard(): void;

    // Release the resources this item owns (an image owns a file on disk).
    public abstract dispose(store: Store): void;

    public abstract toJSON(): ClipboardItemData;

    // `fromJSON` cannot live only on the subclasses: static methods are not
    // polymorphic, so this base router maps the stored `type` to the right
    // subclass. Each subclass registers itself when its module is loaded.
    private static _factories = new Map<ClipboardItemType, ClipboardItemFactory>();

    public static registerType(type: ClipboardItemType, factory: ClipboardItemFactory): void {
        ClipboardItem._factories.set(type, factory);
    }

    public static fromJSON(raw: any): ClipboardItem {
        const type =
            raw?.type === ClipboardItemType.IMAGE
                ? ClipboardItemType.IMAGE
                : ClipboardItemType.TEXT;

        const factory = ClipboardItem._factories.get(type);
        if (!factory) {
            throw new Error(`no clipboard item registered for type ${type}`);
        }
        return factory(raw);
    }
}
