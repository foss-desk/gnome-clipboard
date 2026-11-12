import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';

import { ClipboardItem, ClipboardItemType, Store } from './clipboardItem.js';
import type { ClipboardItemData } from './clipboardItem.js';
import { imageNameFor, imagePathFor, thumbnailPathFor } from './store.js';
import * as log from './log.js';
import { _ } from './i18n.js';

const PREVIEW_MAX_WIDTH = 128;
const PREVIEW_MAX_HEIGHT = 64;
// Very wide/tall images are cropped instead of being rendered as a 1px strip.
const PREVIEW_MAX_ASPECT = 4;

interface PreviewSize {
    width: number;
    height: number;
}

// Measured preview sizes keyed by source path. Shared across items because the
// same image is measured again every time the menu is rebuilt.
const _sizeCache: Map<string, PreviewSize | null> = new Map();

export class ClipboardItemImage extends ClipboardItem {
    public readonly type = ClipboardItemType.IMAGE;

    constructor(id: number) {
        super(id);
    }

    // On-disk name of this image, `<id>.png`.
    public imageName(): string {
        return imageNameFor(this.id);
    }

    // Absolute path of the image file: `<data folder>/images/<id>.png`.
    public filePath(): string {
        return imagePathFor(this.imageName());
    }

    public notification(): string {
        return _('[Image]');
    }

    public displayWidget(): any {
        return this._buildThumbnail();
    }

    public searchText(): string {
        return '';
    }

    public async copyToClipboard(): Promise<void> {
        try {
            const file = Gio.File.new_for_path(this.filePath());
            const bytes = await new Promise<GLib.Bytes>((resolve, reject) => {
                file.load_bytes_async(null, (file: any, res: any) => {
                    try {
                        const [contents] = file.load_bytes_finish(res);
                        resolve(contents);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            const source = Meta.SelectionSourceMemory.new('image/png', bytes);
            global.display
                .get_selection()
                .set_owner(Meta.SelectionType.SELECTION_CLIPBOARD, source);
        } catch (err) {
            log.error(`failed to copy image ${this.id}: ${err}`);
        }
    }

    public dispose(store: Store): void {
        store.deleteImage(this.imageName());
    }

    public toJSON(): ClipboardItemData {
        return {
            type: this.type,
            id: this.id,
            pinned: this.pinned,
            copiedAt: this.copiedAt,
            usage: this.usage,
            usedAt: this.usedAt,
        };
    }

    public static fromJSON(raw: any): ClipboardItemImage {
        const item = new ClipboardItemImage(raw.id);
        item.pinned = raw.pinned;
        item.copiedAt = raw.copiedAt;
        item.usage = raw.usage;
        item.usedAt = raw.usedAt;
        return item;
    }

    // Prefer the cached 256px thumbnail; fall back to the original when no
    // thumbnail could be generated (e.g. the first menu build races startup
    // thumbnail generation).
    private _previewSource(): string {
        const source = this.filePath();
        const thumbPath = thumbnailPathFor(this.imageName());
        try {
            if (Gio.File.new_for_path(thumbPath).query_exists(null)) {
                return thumbPath;
            }
        } catch {
            // Fall through to the original image.
        }
        return source;
    }

    private static _measurePreview(path: string): PreviewSize | null {
        try {
            const [, width, height] = GdkPixbuf.Pixbuf.get_file_info(path);
            if (!width || !height) {
                return null;
            }

            // Fit inside the preview box, but never upscale small images.
            const scale = Math.min(PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height, 1);

            let w = Math.max(1, Math.round(width * scale));
            let h = Math.max(1, Math.round(height * scale));

            // Keep extreme aspect ratios from collapsing into a thin line. CSS
            // `background-size: cover` crops the excess instead.
            const aspect = width / height;
            if (aspect > PREVIEW_MAX_ASPECT) {
                h = Math.max(h, Math.round(w / PREVIEW_MAX_ASPECT));
            } else if (aspect < 1 / PREVIEW_MAX_ASPECT) {
                w = Math.max(w, Math.round(h * PREVIEW_MAX_ASPECT));
            }

            return { width: Math.max(1, w), height: Math.max(1, h) };
        } catch {
            return null;
        }
    }

    private _buildThumbnail(): any {
        const original = this.filePath();
        let source = this._previewSource();
        let size = this._cachedPreviewSize(source);

        // A corrupt/missing thumbnail must not hide a perfectly good source.
        if (!size && source !== original) {
            source = original;
            size = this._cachedPreviewSize(source);
        }

        if (!size) {
            return this._placeholder();
        }

        let uri: string;
        try {
            uri = GLib.filename_to_uri(source, null);
        } catch {
            return this._placeholder();
        }

        // A plain widget with a CSS background image gives us rounded corners
        // (border-radius clips the background) without wrapping the picture in
        // a bordered square like St.Icon did.
        const thumb = new St.Widget({
            style_class: 'clipboard-image-preview',
            style: `background-image: url("${uri}"); min-width: ${size.width}px; min-height: ${size.height}px; max-width: ${size.width}px; max-height: ${size.height}px;`,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            x_expand: false,
            y_expand: false,
        });
        thumb.set_size(size.width, size.height);
        return thumb;
    }

    private _cachedPreviewSize(source: string): PreviewSize | null {
        let size = _sizeCache.get(source);
        if (size === undefined) {
            size = ClipboardItemImage._measurePreview(source);
            _sizeCache.set(source, size);
        }
        return size;
    }

    private _placeholder(): any {
        return new St.Icon({
            icon_name: 'image-x-generic-symbolic',
            icon_size: 32,
            style_class: 'clipboard-image-placeholder',
            x_align: Clutter.ActorAlign.START,
        });
    }
}

ClipboardItem.registerType(ClipboardItemType.IMAGE, ClipboardItemImage.fromJSON);
