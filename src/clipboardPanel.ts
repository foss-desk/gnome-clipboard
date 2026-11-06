import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as History from './history.js';
import * as HistoryMenu from './historyMenu.js';
import * as Settings from './settings.js';
import { ClipboardItem } from './clipboardItem.js';
import { ClipboardItemImage } from './clipboardItemImage.js';
import { ClipboardItemText } from './clipboardItemText.js';
import * as Store from './store.js';
import * as log from './log.js';
import * as utils from './utils.js';
import * as ConfirmDialog from './confirmDialog.js';
import * as ActionBar from './actionBar.js';
import * as SearchBox from './searchBox.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

class ClipboardPanelInternal extends PanelMenu.Button {
    private _history: History.History;
    private _historyMenu: HistoryMenu.HistoryMenu;
    private _settings: Settings.ExtensionSettings;
    private _actionBar: ActionBar.ActionBar;
    private _searchBox: SearchBox.SearchBox;
    private _store: Store.Store;
    private _openPrefs: () => void;

    private _clipboardTimerID: number = 0;
    private _saveTimerID: number = 0;
    private _selectedID: number = 0;
    private _openStateChangedID: number = 0;
    private _keyPressEventID: number = 0;
    private _focusTimerID: number = 0;
    private _selectionOwnerChangedID: number = 0;
    private _settingsChangedID: number = 0;
    private _menuNeedsRebuild: boolean = true;

    constructor(settings: any, _gettext: any, uuid: string, openPrefs: () => void) {
        super(0.0, _('Clipboard'), false);

        log.info('initializing ...');
        this._history = new History.History();
        this._settings = new Settings.ExtensionSettings(settings);
        this._openPrefs = openPrefs;

        const path = GLib.get_user_data_dir() + '/' + uuid;
        this._store = new Store.Store(path);

        this._actionBar = new ActionBar.ActionBar();
        this._searchBox = new SearchBox.SearchBox();
        this._historyMenu = new HistoryMenu.HistoryMenu(
            this._copyToClipboard.bind(this),
            this._onPinItem.bind(this),
            this._onRemoveItem.bind(this),
        );

        // Menu layout: Search → History → Action Bar
        this.menu.addMenuItem(this._searchBox);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._historyMenu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._actionBar);

        this._settingsChangedID = this._settings.onChanged(() => {
            this._refresh();
        });

        this._setupUI();
        this._loadHistory();
        this._setupClipboardMonitoring();
    }

    public init() {
        // Compatibility with extension.ts
    }

    public toggle() {
        this.menu.toggle();
    }

    private _setupUI() {
        this.menu.box.add_style_class_name('gnome-clipboard');

        const icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(icon);

        this._actionBar.onClearHistory(this.clearHistory.bind(this));
        this._actionBar.onNextItem(this.selectNextItem.bind(this));
        this._actionBar.onPrevItem(this.selectPrevItem.bind(this));
        this._actionBar.onOpenSettings(() => this._openPrefs());

        // Search box: filter items as user types
        this._searchBox.onTextChanged(this._onSearch.bind(this));

        // Build the item list on demand, then auto-focus the search box
        this._openStateChangedID = this.menu.connect(
            'open-state-changed',
            (_menu: any, open: boolean) => {
                if (open) {
                    this._updateThemeVariant();
                    if (this._menuNeedsRebuild) {
                        this._rebuildMenu();
                    }
                    if (this._focusTimerID) GLib.source_remove(this._focusTimerID);
                    this._focusTimerID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this._searchBox.setText('');
                        global.stage.set_key_focus(this._searchBox.searchEntry);
                        this._focusTimerID = 0;
                        return GLib.SOURCE_REMOVE;
                    });
                }
            },
        );

        // Redirect key presses from scroll view to search box
        this._keyPressEventID = this._historyMenu.scrollView.connect(
            'key-press-event',
            (_widget: any, _event: any) => {
                global.stage.set_key_focus(this._searchBox.searchEntry);
                return Clutter.EVENT_PROPAGATE;
            },
        );
    }

    // The stylesheet is written for a dark popup. Look at the background the
    // Shell theme actually gives the popup and, if it is light, add the `light`
    // class so the dark-on-light rules apply. Checked on every open so theme and
    // color-scheme changes are picked up without restarting the extension.
    private _updateThemeVariant() {
        const bg = this.menu.box.get_theme_node().get_background_color();
        const luminance = (0.2126 * bg.red + 0.7152 * bg.green + 0.0722 * bg.blue) / 255;
        if (luminance > 0.5) this.menu.box.add_style_class_name('light');
        else this.menu.box.remove_style_class_name('light');
    }

    private async _loadHistory() {
        const history = await this._store.load();
        if (history && history.length > 0) {
            this._history.setItems(history);
            this._refresh();
        }

        // Neither monitoring mode reports what is already on the clipboard when the
        // extension starts: `owner-changed` only fires on a change, and the timer
        // only fires after a full interval, which the user can set as high as 100 s.
        // Read it once here so the extension starts in sync with the current
        // selection -- after the stored history has been restored, so that
        // setItems() cannot discard the entry this adds.
        this._checkClipboard();
    }

    private _setupClipboardMonitoring() {
        // A poll wakes the shell -- and the application that owns the clipboard --
        // twice a second forever, and re-reads the whole clipboard every tick. When
        // an image is on the clipboard that means transferring and MD5-hashing the
        // full PNG on the compositor thread, twice a second, indefinitely.
        //
        // The selection-owner signal delivers exactly the same information, only
        // when something actually changes. The timer is kept for the users who
        // explicitly opted into it via the `clipboard-timer` setting, which was
        // otherwise being ignored.
        if (this._settings.clipboardTimer()) {
            const interval = this._settings.clipboardTimerIntervalInMillisecond();
            log.info(`polling clipboard every ${interval} ms`);
            this._clipboardTimerID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
                this._checkClipboard();
                return GLib.SOURCE_CONTINUE;
            });
            return;
        }

        const selection = global.display.get_selection();
        this._selectionOwnerChangedID = selection.connect(
            'owner-changed',
            (_selection: any, selectionType: number) => {
                if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD) {
                    this._checkClipboard();
                }
            },
        );
    }

    private _checkClipboard() {
        if (!this._actionBar.enable()) return;
        if (this._isFocusAppBlacklisted()) return;

        const clipboard = St.Clipboard.get_default();

        // Ask what formats the clipboard advertises instead of guessing: reading
        // text whenever it is offered means an image copied alongside a text
        // fallback (e.g. a file manager) would be stored as that text.
        let mimetypes: string[] = [];
        try {
            mimetypes = clipboard.get_mimetypes(St.ClipboardType.CLIPBOARD) ?? [];
        } catch (e) {
            log.warn(`unable to read clipboard mimetypes: ${e}`);
        }

        log.debug(`clipboard mimetypes: ${mimetypes.join(', ')}`);

        const hasText = mimetypes.some((m) => m.startsWith('text/'));
        const hasImage = mimetypes.some((m) => m.startsWith('image/'));

        const onSave = (item: ClipboardItem) => {
            this._history.add(item);

            this._selectedID = item.id;
            this._refresh();
            this._saveHistoryDebounced();
        };

        if (hasImage) {
            this._checkImageClipboard(clipboard, onSave);
        }

        if (hasText) {
            this._checkTextClipboard(clipboard, onSave);
        }
    }

    private _checkTextClipboard(clipboard: St.Clipboard, onSave: (item: ClipboardItem) => void) {
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_cb: St.Clipboard, text: string) => {
            if (!text || text.trim().length === 0) return;

            const id = utils.hashText(text);
            onSave(new ClipboardItemText(id, text));
        });
    }

    private _checkImageClipboard(clipboard: St.Clipboard, onSave: (item: ClipboardItem) => void) {
        if (!this._settings.storeImages()) return;

        clipboard.get_content(
            St.ClipboardType.CLIPBOARD,
            'image/png',
            async (_cb: St.Clipboard, bytes: GLib.Bytes) => {
                if (!bytes || bytes.get_size() === 0) return;

                const maxBytes = this._settings.maxImageSizeInBytes();
                if (maxBytes > 0 && bytes.get_size() > maxBytes) {
                    log.info(
                        `ignoring image of ${bytes.get_size()} bytes, larger than ${maxBytes} bytes`,
                    );
                    return;
                }

                const id = utils.hashByte(bytes);
                onSave(new ClipboardItemImage(id));

                const saved = await this._store.saveImage(id, bytes);
                if (!saved) {
                    log.error(`failed to save image ${id}`);
                }
            },
        );
    }

    private async _copyToClipboard(item: ClipboardItem) {
        item.copyToClipboard();

        this._selectedID = item.id;
        this._refresh();

        if (this._settings.showNotifications()) {
            Main.notify(_('Clipboard updated'), item.notification());
        }
    }

    public toggleService() {
        // Manual toggle via switch in ActionBar is handled there
    }

    // Pause or resume clipboard capture. Backs the global capture shortcut and
    // the "Capture" switch in the action bar, which share the same state.
    public toggleCapture() {
        const enabled = this._actionBar.toggleCapture();

        if (this._settings.showNotifications()) {
            Main.notify(
                _('Gnome Clipboard'),
                enabled ? _('Clipboard capture enabled') : _('Clipboard capture paused'),
            );
        }
    }

    public clearHistory() {
        const title = _('Clear history?');
        const message = _('Are you sure you want to remove all items?');
        ConfirmDialog.openConfirmDialog(
            title,
            message,
            '',
            this._doClearHistory.bind(this),
            _('Empty'),
        );
    }

    public selectNextItem() {
        const next = this._historyMenu.nextItem();
        if (next) this._copyToClipboard(next);
    }

    public selectPrevItem() {
        const prev = this._historyMenu.prevItem();
        if (prev) this._copyToClipboard(prev);
    }

    // Called whenever the history changes.
    //
    // Rebuilding the popup means destroying and recreating one menu item per
    // history entry, and every item is a dozen St widgets that each need a full
    // CSS cascade. With a few hundred entries that is hundreds of milliseconds
    // of work on the compositor thread -- far too expensive to spend on every
    // clipboard change for a menu that is usually closed and invisible.
    //
    // So only the cheap, always-needed state is updated here; the widgets are
    // rebuilt lazily the next time the menu is actually opened.
    private _refresh() {
        this._disposeItems(this._history.trim(this._settings.historySize()));

        const sorted = this._history.getSorted();

        this._historyMenu.updateNavigation(sorted, this._selectedID);
        this._actionBar.enablePrevButton(this._historyMenu.hasPrevItem());
        this._actionBar.enableNextButton(this._historyMenu.hasNextItem());

        this._menuNeedsRebuild = true;
        if (this.menu.isOpen) {
            this._rebuildMenu(sorted);
        }
    }

    private _rebuildMenu(sorted?: Array<ClipboardItem>) {
        this._historyMenu.rebuildMenu(sorted ?? this._history.getSorted(), this._selectedID);
        this._onSearch();
        this._menuNeedsRebuild = false;
    }

    private _onSearch() {
        const query = this._searchBox.getText().toLowerCase();
        this._historyMenu.filterItems(query);
    }

    private _onPinItem(item: ClipboardItem) {
        item.pinned = !item.pinned;
        this._refresh();
        this._saveHistoryDebounced();
    }

    private _onRemoveItem(item: ClipboardItem) {
        this._history.delete(item.id);
        this._disposeItems([item]);
        this._refresh();
        this._saveHistoryDebounced();
    }

    private _saveHistoryDebounced() {
        if (this._saveTimerID) GLib.source_remove(this._saveTimerID);
        this._saveTimerID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._store.save(this._history.items(this._settings.savePinned()));
            this._saveTimerID = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    // An item owns whatever resource it holds; release it once the item is gone
    // so an image's PNG does not linger on disk after its history entry.
    private _disposeItems(items: Array<ClipboardItem>) {
        for (const item of items) {
            item.dispose(this._store);
        }
    }

    // Wayland does not tell us which client owns the clipboard, so the best
    // available proxy is the application that has the focus when the selection
    // changes: a copy is almost always made from the focused window. Entries are
    // matched, ignoring case, against the desktop file id (with or without
    // ".desktop"), the application name and the focused window's own class and
    // application id. The window ones matter because the Shell cannot always map
    // a window to a desktop file; it then reports an anonymous "window:N" app.
    private _isFocusAppBlacklisted(): boolean {
        const blacklist = this._settings.blacklist();
        if (blacklist.length === 0) return false;

        const app = Shell.WindowTracker.get_default().focus_app;
        const win = global.display.focus_window;
        const id: string = app?.get_id() ?? '';
        const candidates = [
            id,
            id.replace(/\.desktop$/, ''),
            app?.get_name() ?? '',
            win?.get_wm_class() ?? '',
            win?.get_gtk_application_id() ?? '',
            win?.get_sandboxed_app_id() ?? '',
        ]
            .filter((s) => s.length > 0)
            .map((s) => s.toLowerCase());

        const blocked = blacklist.some((entry) => candidates.includes(entry.toLowerCase()));
        if (blocked) log.info(`skipping blacklisted app: ${candidates.join(', ')}`);
        return blocked;
    }

    private _doClearHistory() {
        this._disposeItems(this._history.getItems());
        this._history.clear();
        this._store.clearAll();
        this._refresh();
    }

    destroy() {
        if (this._clipboardTimerID) GLib.source_remove(this._clipboardTimerID);
        if (this._saveTimerID) GLib.source_remove(this._saveTimerID);
        if (this._focusTimerID) GLib.source_remove(this._focusTimerID);

        if (this._openStateChangedID) {
            this.menu.disconnect(this._openStateChangedID);
            this._openStateChangedID = 0;
        }

        if (this._keyPressEventID) {
            this._historyMenu.scrollView.disconnect(this._keyPressEventID);
            this._keyPressEventID = 0;
        }

        if (this._selectionOwnerChangedID) {
            global.display.get_selection().disconnect(this._selectionOwnerChangedID);
            this._selectionOwnerChangedID = 0;
        }

        if (this._settingsChangedID) {
            this._settings.getSettings().disconnect(this._settingsChangedID);
            this._settingsChangedID = 0;
        }

        super.destroy();
    }
}

export interface ClipboardPanel extends ClipboardPanelInternal {}
export const ClipboardPanel = GObject.registerClass(
    {
        GTypeName: 'ClipboardPanel',
    },
    ClipboardPanelInternal,
);
