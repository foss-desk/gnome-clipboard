import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Clutter from 'gi://Clutter';

import * as ScrollMenu from './scrollMenu.js';
import * as ClipboardItem from './clipboardItem.js';
import * as MenuItem from './menuItem.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export class HistoryMenu
  extends ScrollMenu.ScrollMenu {

  private _onActivateItem: (item: ClipboardItem.ClipboardItem) => void;
  private _onPinItem: (item: ClipboardItem.ClipboardItem) => void;
  private _onRemoveItem: (item: ClipboardItem.ClipboardItem) => void;
  private _nextItem: ClipboardItem.ClipboardItem | null;
  private _prevItem: ClipboardItem.ClipboardItem | null;
  private _items: Map<number, MenuItem.MenuItem>;
  private _headers: Map<string, any>;

  constructor(
    onActivateItem: (item: ClipboardItem.ClipboardItem) => void,
    onPinItem: (item: ClipboardItem.ClipboardItem) => void,
    onRemoveItem: (item: ClipboardItem.ClipboardItem) => void) {
    super()

    this._onActivateItem = onActivateItem;
    this._onPinItem = onPinItem;
    this._onRemoveItem = onRemoveItem;
    this._nextItem = null;
    this._prevItem = null;
    this._items = new Map();
    this._headers = new Map();
  }

  // Keyboard navigation only depends on the sorted history and the current
  // selection, not on the widgets. Keeping it separate from rebuildMenu() lets
  // the shortcuts keep working while the popup is closed and unbuilt.
  public updateNavigation(
    history: Array<ClipboardItem.ClipboardItem>,
    selectedID: number) {

    this._nextItem = null;
    this._prevItem = null;

    const index = history.findIndex(h => h.id() === selectedID);
    if (index < 0) {
      return;
    }

    if (index - 1 >= 0) {
      this._nextItem = history[index - 1];
    }
    if (index + 1 < history.length) {
      this._prevItem = history[index + 1];
    }
  }

  public rebuildMenu(
    history: Array<ClipboardItem.ClipboardItem>,
    selectedID: number) {

    if (history.length === 0) {
        super.removeAll();
        this._items.clear();
        this._headers.clear();
        this._showEmptyState();
        return;
    }

    this.scrollViewSection.removeAll();
    this._items.clear();
    this._headers.clear();

    const pinned = history.filter(h => h.pinned);
    const recent = history.filter(h => !h.pinned);

    if (pinned.length > 0) {
      this._addHeader(_("Pinned"));
      pinned.forEach((info) => {
        this._addItem(info, selectedID);
      });
      super.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    if (recent.length > 0) {
      this._addHeader(_("Recent History"));
      recent.forEach((info) => {
        this._addItem(info, selectedID);
      });
    }
  }

  private _addHeader(title: string) {
      let header = new PopupMenu.PopupBaseMenuItem({
          reactive: false,
          activate: false,
          style_class: 'section-header'
      });
      header.add_child(new St.Label({ text: title, style_class: 'section-header-label' }));
      super.addMenuItem(header);
  }

  private _addItem(info: ClipboardItem.ClipboardItem, selectedID: number) {
    let item = new MenuItem.MenuItem(info,
      this.onActivateItem.bind(this),
      this.onPinItem.bind(this),
      this.onRemoveItem.bind(this),
    );
    this._items.set(info.id(), item);

    if (info.id() == selectedID) {
      (item as any).add_style_class_name('selected');
    } else {
      (item as any).remove_style_class_name('selected');
    }

    super.addMenuItem(item);
  }

  private _showEmptyState() {
      let box = new St.BoxLayout({
          orientation: Clutter.Orientation.VERTICAL,
          x_expand: true,
          y_expand: true,
          style_class: 'empty-state',
          x_align: Clutter.ActorAlign.CENTER,
          y_align: Clutter.ActorAlign.CENTER
      });

      let icon = new St.Icon({
          icon_name: 'edit-copy-symbolic',
          style_class: 'empty-state-icon'
      });
      box.add_child(icon);

      let label = new St.Label({
          text: _("Clipboard is empty"),
          style_class: 'empty-state-label'
      });
      box.add_child(label);

      let container = new PopupMenu.PopupBaseMenuItem({
          reactive: false,
          activate: false,
          hover: false
      });
      container.add_child(box);
      super.addMenuItem(container);
  }

  public nextItem() {
    return this._nextItem;
  }

  public prevItem() {
    return this._prevItem;
  }

  public hasNextItem() {
    return this._nextItem != null;
  }

  public hasPrevItem() {
    return this._prevItem != null;
  }

  public scrollToItem(id: number) {
      const item = this._items.get(id);
      if (item) {
          // Update selected style class for all items
          for (const [itemId, menuItem] of this._items) {
              if (itemId === id) {
                  (menuItem as any).add_style_class_name('selected');
              } else {
                  (menuItem as any).remove_style_class_name('selected');
              }
          }

          const adjustment = this.scrollView.get_vscroll_bar().get_adjustment();
          const value = adjustment.value;
          const pageSize = adjustment.page_size;

          const alloc = (item as any).get_allocation_box();
          const itemY = alloc.y1;
          const itemHeight = (item as any).height;

          if (itemY < value) {
              adjustment.set_value(itemY);
          } else if (itemY + itemHeight > value + pageSize) {
              adjustment.set_value(itemY + itemHeight - pageSize);
          }
      }
  }

  public updateItemsUI() {
      for (const item of this._items.values()) {
          item.updateUI();
      }
  }

  public filterItems(query: string) {
      for (const [_id, item] of this._items) {
          if (!query || query.length === 0) {
              (item as any).actor?.show?.();
              (item as any).show?.();
          } else {
              const text = item.cbInfo.text?.toLowerCase() ?? '';
              const matches = text.includes(query);
              if (matches) {
                  (item as any).actor?.show?.();
                  (item as any).show?.();
              } else {
                  (item as any).actor?.hide?.();
                  (item as any).hide?.();
              }
          }
      }
  }

  private onActivateItem(item: MenuItem.MenuItem) {
    this._onActivateItem(item.cbInfo);
  }

  private onRemoveItem(item: MenuItem.MenuItem) {
    this._onRemoveItem(item.cbInfo);
  }

  private onPinItem(item: MenuItem.MenuItem) {
    this._onPinItem(item.cbInfo);
  }
};