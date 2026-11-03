import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import * as log from './log.js';

// Longest edge of a cached preview. The menu only shows ~208px wide previews,
// but a larger thumbnail keeps them crisp on HiDPI displays and gives the
// preview widget room to crop very wide/tall images.
const THUMB_MAX_SIZE = 512;
const THUMB_SUFFIX = '.thumb.png';

// Thumbnails live next to their source as `<image>.thumb.png`.
export function thumbnailPathFor(imagePath: string): string {
  return imagePath.replace(/\.png$/i, THUMB_SUFFIX);
}

export class Store {
  private _path: string = "";
  private _imagesDir: string = "";

  constructor(dir: string) {
    // Make sure path exists
    let ret = GLib.mkdir_with_parents(dir, parseInt('0700', 8))
    if (ret == 0) {
      this._path = GLib.build_filenamev([dir, "history.json"]);
      this._imagesDir = GLib.build_filenamev([dir, "images"]);
      GLib.mkdir_with_parents(this._imagesDir, parseInt('0700', 8));
      log.info(`store location set to ${this._path}`);
    } else {
      log.error(`unable to create store directory: ${dir}`);
    }
  }

  async load(): Promise<any> {
    log.info(`loading history async from ${this._path}`);

    try {
      let file = Gio.file_new_for_path(this._path);
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
      if (!data) return "";
      try {
          // Robust wrapper for GJS binary data
          const ui8 = (data instanceof Uint8Array) ? data : new Uint8Array(data);
          return new TextDecoder().decode(ui8);
      } catch (e) {
          log.warn(`TextDecoder failed, using byte fallback: ${e}`);
          let text = "";
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
      let json = JSON.stringify(history);
      let file = Gio.file_new_for_path(this._path);
      const bytes = GLib.Bytes.new(new TextEncoder().encode(json));

      await new Promise<void>((resolve, reject) => {
        file.replace_contents_async(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null, (file: any, res: any) => {
            try {
                file.replace_contents_finish(res);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
      });
    } catch (err) {
      log.error(`save history failed: ${err}`);
    }
  }

  // `hash` is the full MD5 hex digest of the image bytes. Naming the file after
  // the complete digest avoids the 32-bit collision that could overwrite
  // another image while its history entry still pointed at the old path.
  async saveImage(hash: string, bytes: any): Promise<string | null> {
    let filename = `${hash}.png`;
    let path = GLib.build_filenamev([this._imagesDir, filename]);
    try {
      let file = Gio.file_new_for_path(path);

      await new Promise<void>((resolve, reject) => {
        file.replace_contents_async(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null, (file: any, res: any) => {
            try {
                file.replace_contents_finish(res);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
      });

      await this.ensureThumbnail(path);
      return path;
    } catch (err) {
      log.error(`failed to save image: ${err}`);
      return null;
    }
  }

  // Generates `<image>.thumb.png` when it does not exist yet. Existing
  // (pre-refactor) images get thumbnails lazily at startup.
  async ensureThumbnail(imagePath: string): Promise<string | null> {
    const thumbPath = thumbnailPathFor(imagePath);

    try {
      const imageFile = Gio.file_new_for_path(imagePath);
      if (!imageFile.query_exists(null)) {
        return null;
      }

      const thumbFile = Gio.file_new_for_path(thumbPath);
      if (thumbFile.query_exists(null)) {
        return thumbPath;
      }

      // Read through a stream so scaling happens during decode instead of
      // putting a second full copy of a large PNG in memory.
      const stream = imageFile.read(null);
      if (!stream) {
        return null;
      }

      let pixbuf: any;
      try {
        pixbuf = await new Promise<any>((resolve, reject) => {
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
            });
        });
      } finally {
        try {
          stream.close(null);
        } catch {
          // Stream is already closed or failed; nothing useful to do.
        }
      }

      if (!pixbuf) {
        return null;
      }

      // The item may have been removed while the image was decoding; don't
      // leave a thumbnail behind for an image that no longer exists.
      if (!imageFile.query_exists(null)) {
        return null;
      }

      pixbuf.savev(thumbPath, 'png', ['compression'], ['9']);
      return thumbPath;
    } catch (err) {
      log.warn(`failed to create thumbnail for ${imagePath}: ${err}`);
      return null;
    }
  }

  async ensureThumbnails(imagePaths: string[]) {
    for (const path of imagePaths) {
      if (path) {
        await this.ensureThumbnail(path);
      }
    }
  }

  deleteImage(path: string) {
    // The path comes from history.json, which the user can edit by hand, so
    // never delete anything outside our own images directory.
    if (GLib.path_get_dirname(path) !== this._imagesDir) {
      log.warn(`refusing to delete image outside ${this._imagesDir}: ${path}`);
      return;
    }

    this._deleteFile(path);
    this._deleteFile(thumbnailPathFor(path));
  }

  private _deleteFile(path: string) {
    try {
      let file = Gio.file_new_for_path(path);
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
