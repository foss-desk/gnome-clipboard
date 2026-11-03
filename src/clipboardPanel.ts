import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as History from './history.js';
import * as HistoryMenu from './historyMenu.js';
import * as Settings from './settings.js';
import * as ClipboardItem from './clipboardItem.js';
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
    super(0.0, _("Clipboard"), false);

    log.info("initializing ...");
    this._history = new History.History();
    this._settings = new Settings.ExtensionSettings(settings);
    this._openPrefs = openPrefs;

    let path = GLib.get_user_data_dir() + '/' + uuid;
    this._store = new Store.Store(path);

    this._actionBar = new ActionBar.ActionBar();
    this._searchBox = new SearchBox.SearchBox();
    this._historyMenu = new HistoryMenu.HistoryMenu(
        this._copyToClipboard.bind(this),
        this._onPinItem.bind(this),
        this._onRemoveItem.bind(this)
    );
    
    // Menu layout: Search → History → Action Bar
    this.menu.addMenuItem(this._searchBox);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this.menu.addMenuItem(this._historyMenu);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this.menu.addMenuItem(this._actionBar);

    // Turning "save only pinned items" on must drop the unpinned ones from the
    // file right away, not whenever the next copy happens to trigger a save.
    this._settingsChangedID = this._settings.onChanged(() => this._saveHistoryDebounced());

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

    let icon = new St.Icon({
      icon_name: 'edit-paste-symbolic',
      style_class: 'system-status-icon'
    });
    this.add_child(icon);

    this._actionBar.onClearHistory(this.clearHistory.bind(this));
    this._actionBar.onNextItem(this.selectNextItem.bind(this));
    this._actionBar.onPrevItem(this.selectPrevItem.bind(this));
    this._actionBar.onTogglePrivateMode(this.togglePrivateMode.bind(this));
    this._actionBar.onOpenSettings(() => this._openPrefs());

    // Search box: filter items as user types
    this._searchBox.onTextChanged(this._onSearch.bind(this));

    // Build the item list on demand, then auto-focus the search box
    this._openStateChangedID = this.menu.connect('open-state-changed',
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
      });

    // Redirect key presses from scroll view to search box
    this._keyPressEventID = this._historyMenu.scrollView.connect('key-press-event',
      (_widget: any, _event: any) => {
        global.stage.set_key_focus(this._searchBox.searchEntry);
        return Clutter.EVENT_PROPAGATE;
      });
  }

  // The stylesheet is written for a dark popup. Look at the background the
  // Shell theme actually gives the popup and, if it is light, add the `light`
  // class so the dark-on-light rules apply. Checked on every open so theme and
  // color-scheme changes are picked up without restarting the extension.
  private _updateThemeVariant() {
    const bg = this.menu.box.get_theme_node().get_background_color();
    const luminance = (0.2126 * bg.red + 0.7152 * bg.green + 0.0722 * bg.blue) / 255;
    if (luminance > 0.5)
      this.menu.box.add_style_class_name('light');
    else
      this.menu.box.remove_style_class_name('light');
  }

  private async _loadHistory() {
    let history = await this._store.load();
    if (history && history.length > 0) {
        this._history.setItems(history);
        this._refresh();
        this._store.ensureThumbnails(this._imagePaths());
    }

    // Neither monitoring mode reports what is already on the clipboard when the
    // extension starts: `owner-changed` only fires on a change, and the timer
    // only fires after a full interval, which the user can set as high as 100 s.
    // Read it once here so the extension starts in sync with the current
    // selection -- after the stored history has been restored, so that
    // setItems() cannot discard the entry this adds.
    this._checkClipboard();
  }

  private _imagePaths(): string[] {
    const paths: string[] = [];
    for (const item of this._history.getItems()) {
      if (item.type === ClipboardItem.ClipboardItemType.IMAGE && item.imagePath) {
        paths.push(item.imagePath);
      }
    }
    return paths;
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
    this._selectionOwnerChangedID = selection.connect('owner-changed',
      (_selection: any, selectionType: number) => {
        if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD) {
            this._checkClipboard();
        }
      });
  }

  private _checkClipboard() {
    if (!this._actionBar.enable() || this._settings.privateMode()) return;
    if (this._isFocusAppBlacklisted()) return;

    const clipboard = St.Clipboard.get_default();
    
    clipboard.get_text(St.ClipboardType.CLIPBOARD, (_cb: any, text: string) => {
        try {
            if (text && text.trim().length > 0) {
                if (this._addClipboard(text)) {
                    this._refresh();
                    this._saveHistoryDebounced();
                }
            } else {
                this._checkImageClipboard();
            }
        } catch (e) {
            log.error(`Check clipboard failed: ${e}`);
        }
    });
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
    ].filter(s => s.length > 0).map(s => s.toLowerCase());

    const blocked = blacklist.some(entry => candidates.includes(entry.toLowerCase()));
    if (blocked) log.info(`skipping blacklisted app: ${candidates.join(', ')}`);
    return blocked;
  }

  private _checkImageClipboard() {
    const clipboard = St.Clipboard.get_default();
    
    clipboard.get_content(St.ClipboardType.CLIPBOARD, 'image/png', (_cb: any, bytes: any) => {
        try {
            if (bytes && bytes.get_size() > 0) {
                this._processImageBytes(bytes);
            }
        } catch (e) {}
    });
  }

  private async _processImageBytes(bytes: any) {
    const hash = utils.checksumBytes(bytes);
    const id = utils.hashCode(hash);
    if (id == this._selectedID) return;

    let path = await this._store.saveImage(hash, bytes);
    if (path) {
        this._selectedID = id;
        this._addToHistory("", 1, false, Date.now(), Date.now(), ClipboardItem.ClipboardItemType.IMAGE, path);
        this._refresh();
        this._saveHistoryDebounced();
    }
  }

  private _addClipboard(text: string): boolean {
    let id = utils.hashCode(text);
    if (id == this._selectedID) return false;

    this._selectedID = id;
    return this._addToHistory(text, 1, false, Date.now(), Date.now(), ClipboardItem.ClipboardItemType.TEXT);
  }

  private _addToHistory(text: string, count: number, pinned: boolean, created: number, updated: number, type: number, path?: string): boolean {
    let item = new ClipboardItem.ClipboardItem(text, count, pinned, created, updated, type, path);
    return this._history.add(item);
  }

  private async _copyToClipboard(item: ClipboardItem.ClipboardItem) {
    if (item.type === ClipboardItem.ClipboardItemType.IMAGE && item.imagePath) {
        const file = Gio.File.new_for_path(item.imagePath);
        const [bytes] = file.load_bytes(null);
        const source = Meta.SelectionSourceMemory.new('image/png', bytes);
        global.display.get_selection().set_owner(
            Meta.SelectionType.SELECTION_CLIPBOARD,
            source
        );
    } else {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, item.text);
    }
    
    this._selectedID = item.id();
    this._refresh();

    if (this._settings.showNotifications()) {
      Main.notify(_("Clipboard updated"), item.display());
    }
  }

  public toggleService() {
      // Manual toggle via switch in ActionBar is handled there
  }

  public clearHistory() {
      const title = _("Clear history?");
      const message = _("Are you sure you want to remove all items?");
      ConfirmDialog.openConfirmDialog(title, message, "", this._doClearHistory.bind(this), _("Empty"));
  }

  public togglePrivateMode() {
      this._settings.setPrivateMode(!this._settings.privateMode());
      this._actionBar.setPrivateMode(this._settings.privateMode());
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
    this._deleteImages(this._history.trim(this._settings.historySize()));

    const sorted = this._history.getSorted(this._settings.historySort());

    this._historyMenu.updateNavigation(sorted, this._selectedID);
    this._actionBar.enablePrevButton(this._historyMenu.hasPrevItem());
    this._actionBar.enableNextButton(this._historyMenu.hasNextItem());

    this._menuNeedsRebuild = true;
    if (this.menu.isOpen) {
      this._rebuildMenu(sorted);
    }
  }

  private _rebuildMenu(sorted?: Array<ClipboardItem.ClipboardItem>) {
    this._historyMenu.rebuildMenu(
      sorted ?? this._history.getSorted(this._settings.historySort()),
      this._selectedID);
    this._onSearch();
    this._menuNeedsRebuild = false;
  }

  private _onSearch() {
    let query = this._searchBox.getText().toLowerCase();
    this._historyMenu.filterItems(query);
  }

  private _onPinItem(item: ClipboardItem.ClipboardItem) {
      item.pinned = !item.pinned;
      this._refresh();
      this._saveHistoryDebounced();
  }

  private _onRemoveItem(item: ClipboardItem.ClipboardItem) {
      this._history.delete(item.id());
      this._deleteImages([item]);
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

  // An image item owns a PNG in the store; once the item is gone nothing else
  // references that file, so remove it instead of leaving it on disk.
  private _deleteImages(items: Array<ClipboardItem.ClipboardItem>) {
    for (const item of items) {
      if (item.type === ClipboardItem.ClipboardItemType.IMAGE && item.imagePath)
        this._store.deleteImage(item.imagePath);
    }
  }

  private _doClearHistory(){
    this._deleteImages(this._history.getItems());
    this._history.clear();
    this._store.save([]);
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
export var ClipboardPanel = GObject.registerClass({
    GTypeName: 'ClipboardPanel'
}, ClipboardPanelInternal);
