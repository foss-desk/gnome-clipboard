
export const SCHEMA_ID = 'org.gnome.shell.extensions.gnome-clipboard';

export const HISTORY_SIZE = "history-size";
export const HISTORY_SORT = "history-sort";
export const CLIPBOARD_TIMER = "clipboard-timer";
export const TIMER_INTERVAL = "timer-interval";
export const SAVE_PINNED = "save-pinned";
export const SHOW_NOTIFICATIONS = "show-notifications";
export const STORE_IMAGES = "store-images";
export const MAX_IMAGE_SIZE = "max-image-size";
export const PRIVATE_MODE = "private-mode";
export const BLACKLIST = "blacklist";
export const SHORTCUT_MENU = "shortcut-menu";
export const SHORTCUT_CLEAR = "shortcut-clear";
export const SHORTCUT_PRIVATE_MODE = "shortcut-private-mode";
export const SHORTCUT_NEXT = "shortcut-next";
export const SHORTCUT_PREV = "shortcut-prev";


export const HISTORY_SORT_COPY_TIME = 0;
export const HISTORY_SORT_RECENT_USAGE = 1;
export const HISTORY_SORT_MOST_USAGE = 2;

export class ExtensionSettings {
    private _settings: Gio.Settings;

    constructor(settings: Gio.Settings) {
        this._settings = settings;
    }

    onChanged(callback: () => void): number {
        return this._settings.connect('changed', callback);
    }

    historySize(): number {
        return this._settings.get_uint(HISTORY_SIZE);
    }

    historySort(): number {
        return this._settings.get_uint(HISTORY_SORT);
    }

    clipboardTimer(): boolean {
        return this._settings.get_boolean(CLIPBOARD_TIMER);
    }

    clipboardTimerIntervalInMillisecond(): number {
        return this._settings.get_uint(TIMER_INTERVAL);
    }

    savePinned(): boolean {
        return this._settings.get_boolean(SAVE_PINNED);
    }

    showNotifications(): boolean {
        return this._settings.get_boolean(SHOW_NOTIFICATIONS);
    }

    storeImages(): boolean {
        return this._settings.get_boolean(STORE_IMAGES);
    }

    maxImageSizeInBytes(): number {
        return this._settings.get_uint(MAX_IMAGE_SIZE) * 1024 * 1024;
    }

    privateMode(): boolean {
        return this._settings.get_boolean(PRIVATE_MODE);
    }

    setPrivateMode(value: boolean) {
        this._settings.set_boolean(PRIVATE_MODE, value);
    }

    blacklist(): string[] {
        return this._settings.get_strv(BLACKLIST);
    }

    shortcutMenu(): string[] {
        return this._settings.get_strv(SHORTCUT_MENU);
    }
    
    shortcutClear(): string[] {
        return this._settings.get_strv(SHORTCUT_CLEAR);
    }
    
    shortcutPrivateMode(): string[] {
        return this._settings.get_strv(SHORTCUT_PRIVATE_MODE);
    }
    
    shortcutNext(): string[] {
        return this._settings.get_strv(SHORTCUT_NEXT);
    }
    
    shortcutPrev(): string[] {
        return this._settings.get_strv(SHORTCUT_PREV);
    }

    getSettings(): Gio.Settings {
        return this._settings;
    }
}