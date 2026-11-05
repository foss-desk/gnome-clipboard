import GLib from 'gi://GLib';
// In GNOME 45+, imports.byteArray is deprecated. Use standard JS methods or GLib.
// However, GJS still supports it for now, but let's try to be clean.

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as log from './log.js';

export function log_methods(obj: any) {
    const result = [];
    for (const id in obj) {
        try {
            if (typeof obj[id] == 'function') {
                result.push(id + ': ' + obj[id].toString());
            }
        } catch {
            result.push(id + ': inaccessible');
        }
    }

    log.info(result.toString());
}

export function log_object(obj: any) {
    const seen: object[] = [];
    const json = JSON.stringify(obj, function (_key, val) {
        if (val != null && typeof val == 'object') {
            if (seen.indexOf(val) >= 0) {
                return;
            }
            seen.push(val);
        }
        return val;
    });
    log.info(json);
}

// 32-bit FNV-1a hash. Returns an unsigned value so it is stable as a history
// key and safe to embed directly in an image file name.
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32(data: ArrayLike<number>): number {
    let hash = FNV_OFFSET;
    for (let i = 0; i < data.length; i++) {
        hash ^= data[i];
        hash = Math.imul(hash, FNV_PRIME);
    }
    return hash >>> 0;
}

// Hash raw bytes (image data).
export function hashByte(bytes: GLib.Bytes): number {
    const data = bytes?.get_data?.();
    return data ? fnv1a32(data) : FNV_OFFSET;
}

// Hash text through the same byte path (UTF-8).
export function hashText(text: string): number {
    return fnv1a32(new TextEncoder().encode(text));
}

export function truncate(text: string, length: number): string {
    text = text.trim();
    text = text.replace(/\s+/g, ' ');

    if (text.length > length) {
        text = text.substring(0, length - 1) + '...';
    }

    return text;
}

export function spawnAsync(...args: string[]) {
    try {
        const flags = GLib.SpawnFlags.SEARCH_PATH;
        GLib.spawn_async(null, args, null, flags, null);
    } catch (err) {
        log.error(`an exception occurred: ${err}`);
    }
}

export async function spawnSync(...args: string[]) {
    try {
        const proc = new Gio.Subprocess({
            argv: args,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        proc.init(null);

        return new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, null, (proc: any, res: any) => {
                try {
                    const [_stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (stderr && stderr.length > 0) {
                        log.error(`an error occurred: ${stderr}`);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                } catch (err) {
                    log.error(`an exception occurred: ${err}`);
                    reject(err);
                }
            });
        });
    } catch (err) {
        log.error(`an exception occurred: ${err}`);
        return false;
    }
}

// St.BoxLayout gained `orientation` in GNOME 48 (deprecating `vertical`);
// GNOME 45-47 only know `vertical` and throw on `orientation`.
const hasBoxOrientation = GObject.Object.find_property.call(St.BoxLayout, 'orientation') !== null;

export function boxOrientation(orientation: number): object {
    if (hasBoxOrientation) {
        return { orientation };
    }
    return { vertical: orientation === Clutter.Orientation.VERTICAL };
}
