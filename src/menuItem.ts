import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as ClipboardItem from './clipboardItem.js';

export class MenuItem
  extends PopupMenu.PopupBaseMenuItem {

  public cbInfo: ClipboardItem.ClipboardItem;
  private static _iconCache: Map<string, any> = new Map();
  private _timeLabel: any;
  private _contentLabel: any;
  private _contentIcon: any;
  private _pinBtn: any;

  static {
    GObject.registerClass(this);
  }

  constructor(
    cbInfo: ClipboardItem.ClipboardItem,
    onActivate: (item: MenuItem) => void,
    onPin: (item: MenuItem) => void,
    onRemove: (item: MenuItem) => void) {

    super({
        style_class: 'clipboard-item'
    });

    this.cbInfo = cbInfo;

    // Main horizontal row
    let row = new St.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    // Left: content + meta (stacked vertically, expands)
    let bodyBox = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    if (cbInfo.type === ClipboardItem.ClipboardItemType.IMAGE && cbInfo.imagePath) {
      let gicon = MenuItem._iconCache.get(cbInfo.imagePath);
      if (!gicon) {
          let file = Gio.file_new_for_path(cbInfo.imagePath);
          gicon = Gio.Icon.new_for_string(file.get_path());
          MenuItem._iconCache.set(cbInfo.imagePath, gicon);
      }
      this._contentIcon = new St.Icon({
        gicon: gicon,
        icon_size: 48,
        style_class: 'clipboard-image-preview',
      });
      bodyBox.add_child(this._contentIcon);
    } else {
      this._contentLabel = new St.Label({
          text: cbInfo.display(),
          style_class: 'clipboard-item-text',
      });
      this._contentLabel.clutter_text.line_wrap = true;
      bodyBox.add_child(this._contentLabel);
    }

    this._timeLabel = new St.Label({
        text: this._formatRelativeTime(cbInfo.copiedAt),
        style_class: 'clipboard-item-meta',
    });
    bodyBox.add_child(this._timeLabel);
    row.add_child(bodyBox);

    // Right: action buttons (pin + remove)
    let actionBox = new St.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL,
        x_align: Clutter.ActorAlign.END,
        y_align: Clutter.ActorAlign.CENTER,
    });

    this._pinBtn = this._createActionBtn('view-pin-symbolic', cbInfo.pinned ? 'pinned' : 'unpinned');
    this._pinBtn.connect('clicked', () => onPin(this));
    actionBox.add_child(this._pinBtn);

    let removeBtn = this._createActionBtn('edit-delete-symbolic', 'remove-icon');
    removeBtn.connect('clicked', () => onRemove(this));
    actionBox.add_child(removeBtn);

    row.add_child(actionBox);
    this.add_child(row);

    this.connect('activate', () => {
      onActivate(this);
    });
  }

  public updateUI() {
    this._timeLabel.set_text(this._formatRelativeTime(this.cbInfo.copiedAt));

    if (this._contentLabel) {
        this._contentLabel.set_text(this.cbInfo.display());
    }

    if (this._contentIcon && this.cbInfo.type === ClipboardItem.ClipboardItemType.IMAGE && this.cbInfo.imagePath) {
        let gicon = MenuItem._iconCache.get(this.cbInfo.imagePath);
        if (gicon) {
            this._contentIcon.set_gicon(gicon);
        }
    }

    this._pinBtn.remove_style_class_name('pinned');
    this._pinBtn.remove_style_class_name('unpinned');
    this._pinBtn.add_style_class_name(this.cbInfo.pinned ? 'pinned' : 'unpinned');
  }

  private _createActionBtn(iconName: string, extraClass: string) {
      return new St.Button({
          style_class: `item-action-btn ${extraClass}`,
          child: new St.Icon({
              icon_name: iconName,
              icon_size: 14,
              style_class: 'popup-menu-icon',
          }),
          can_focus: true,
          track_hover: true,
      });
  }

  private _formatRelativeTime(timestamp: number): string {
      let diff = (Date.now() - timestamp) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
  }

  text(): string {
    return this.cbInfo.text;
  }
}