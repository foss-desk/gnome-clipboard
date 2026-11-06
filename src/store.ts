import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import * as log from './log.js';

// Longest edge of a cached preview. The menu renders previews in a box of at
// most 128x64 CSS px (PREVIEW_MAX_* in clipboardItemImage.ts), so 256px is
// enough to stay crisp on 2x HiDPI displays without storing a needlessly large
// file.
const THUMB_MAX_SIZE = 256;
const THUMB_SUFFIX = '.thumb.png';

// The directory holding image files, published when a Store is constructed.
// Clipboard items keep only a file name and resolve the absolute path through
// these helpers, so the history file never bakes in an absolute path.
let _activeImagesDir: string = '';

// An image is stored as `<id>.png`; this is the name clipboard items carry.
export function imageNameFor(id: number): string {
    return `${id}.png`;
}

// Full path of an image: `<data folder>/images/<name>`.
export function imagePathFor(imageName: string): string {
    return GLib.build_filenamev([_activeImagesDir, imageName]);
}

// Thumbnails live next to their source as `<image>.thumb.png`.
export function thumbnailPathFor(imageName: string): string {
    return imagePathFor(imageName).replace(/\.png$/i, THUMB_SUFFIX);
}

export class Store {
    private _path: string = '';
    private _imagesDir: string = '';

    constructor(dir: string) {
        // Make sure path exists
        const ret = GLib.mkdir_with_parents(dir, parseInt('0700', 8));
        if (ret === 0) {
            this._path = GLib.build_filenamev([dir, 'history.json']);
            this._imagesDir = GLib.build_filenamev([dir, 'images']);
            _activeImagesDir = this._imagesDir;
            GLib.mkdir_with_parents(this._imagesDir, parseInt('0700', 8));
            log.info(`store location set to ${this._path}`);
        } else {
            log.error(`unable to create store directory: ${dir}`);
        }
    }

    async load(): Promise<any> {
        log.info(`loading history async from ${this._path}`);

        try {
            const file = Gio.file_new_for_path(this._path);
            if (!file.query_exists(null)) {
                return [];
            }

            const result = await new Promise<any>((resolve, reject) => {
                file.load_contents_async(null, (file: any, res: any) => {
                    try {
                        resolve(file.load_contents_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            // GJS returns [ok: boolean, contents: Uint8Array, etag: string]; older
            // releases returned [contents, etag]. Pick the byte array out of either
            // form -- the old code assumed [contents, etag] and fed the boolean
            // `true` to the decoder instead, so every startup failed to parse and
            // the history was dropped.
            const contents = Array.isArray(result)
                ? result.find((v: any) => v instanceof Uint8Array)
                : result;

            if (!contents) {
                return [];
            }

            let text = this._safeDecode(contents);
            if (text && text.trim().length > 0) {
                // Remove Byte Order Mark (BOM) if present
                text = text.replace(/^\uFEFF/, '').trim();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    log.error(`JSON parse failed for ${this._path}: ${e}`);
                    return [];
                }
            }
        } catch (err) {
            log.error(`load history failed: ${err}`);
        }

        return [];
    }

    private _safeDecode(data: any): string {
        if (!data) return '';
        try {
            // Robust wrapper for GJS binary data
            const ui8 = data instanceof Uint8Array ? data : new Uint8Array(data);
            return new TextDecoder().decode(ui8);
        } catch (e) {
            log.warn(`TextDecoder failed, using byte fallback: ${e}`);
            let text = '';
            let bytes = data;
            if (data && typeof data.get_data === 'function') {
                bytes = data.get_data();
            }
            if (bytes && bytes.length) {
                for (let i = 0; i < bytes.length; i++) {
                    text += String.fromCharCode(bytes[i]);
                }
            }
            return text;
        }
    }

    async save(history: any) {
        try {
            const json = JSON.stringify(history);
            const bytes = GLib.Bytes.new(new TextEncoder().encode(json));
            await this._replaceContents(this._path, bytes);
        } catch (err) {
            log.error(`save history failed: ${err}`);
        }
    }

    // Atomically write `bytes` to `path`. Shared by the history file and the
    // image files.
    private async _replaceContents(path: string, bytes: GLib.Bytes): Promise<void> {
        const file = Gio.file_new_for_path(path);
        await new Promise<void>((resolve, reject) => {
            file.replace_contents_async(
                bytes,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
                (file: any, res: any) => {
                    try {
                        file.replace_contents_finish(res);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                },
            );
        });
    }

    // `id` is the 32-bit content hash of the image bytes; the file is named
    // `<id>.png`. Returns the image file name (not the full path) on success.
    async saveImage(id: number, bytes: GLib.Bytes): Promise<string | null> {
        const imageName = imageNameFor(id);
        try {
            await this._replaceContents(imagePathFor(imageName), bytes);

            // A decode failure must not lose the image itself, so a thumbnail
            // problem is only logged.
            try {
                await this._writeThumbnail(bytes, thumbnailPathFor(imageName));
            } catch (err) {
                log.warn(`failed to create thumbnail for ${imageName}: ${err}`);
            }

            return imageName;
        } catch (err) {
            log.error(`failed to save image: ${err}`);
            return null;
        }
    }

    // Decode the image at thumbnail scale straight from the bytes we already
    // hold and write `<image>.thumb.png`. Scaling happens during decode, so no
    // full-size second copy is materialised.
    private async _writeThumbnail(bytes: GLib.Bytes, thumbPath: string): Promise<void> {
        const stream = Gio.MemoryInputStream.new_from_bytes(bytes);
        const pixbuf = await new Promise<any>((resolve, reject) => {
            GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
                stream,
                THUMB_MAX_SIZE,
                THUMB_MAX_SIZE,
                true,
                null,
                (_stream: any, res: any) => {
                    try {
                        resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                },
            );
        });

        pixbuf.savev(thumbPath, 'png', ['compression'], ['9']);
    }

    deleteImage(imageName: string) {
        const path = imagePathFor(imageName);

        // The name comes from history.json, which the user can edit by hand, so
        // never delete anything outside our own images directory.
        if (GLib.path_get_dirname(path) !== this._imagesDir) {
            log.warn(`refusing to delete image outside ${this._imagesDir}: ${path}`);
            return;
        }

        this._deleteFile(path);
        this._deleteFile(thumbnailPathFor(imageName));
    }

    clearAll() {
        this._deleteRecursive(this._imagesDir);
        this._deleteFile(this._path);
        GLib.mkdir_with_parents(this._imagesDir, parseInt('0700', 8));
    }

    private _deleteRecursive(path: string) {
        let file: any;
        try {
            file = Gio.file_new_for_path(path);
            if (!file.query_exists(null)) {
                return;
            }

            const info = file.query_info(
                'standard::type',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null,
            );

            if (info.get_file_type() !== Gio.FileType.DIRECTORY) {
                file.delete(null);
                return;
            }

            const enumerator = file.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null,
            );
            try {
                let child;
                while ((child = enumerator.next_file(null)) !== null) {
                    this._deleteRecursive(GLib.build_filenamev([path, child.get_name()]));
                }
            } finally {
                enumerator.close(null);
            }

            file.delete(null);
        } catch (err) {
            if ((err as any)?.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                return;
            }
            log.warn(`failed to delete ${path}: ${err}`);
        }
    }

    private _deleteFile(path: string) {
        try {
            const file = Gio.file_new_for_path(path);
            if (file.query_exists(null)) {
                file.delete(null);
            }
        } catch (err) {
            if ((err as any)?.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                return;
            }
            log.warn(`failed to delete ${path}: ${err}`);
        }
    }
}
