import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as ClipboardItem from './clipboardItem.js';
import * as utils from './utils.js';
import { thumbnailPathFor } from './store.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

const PREVIEW_MAX_WIDTH = 208;
const PREVIEW_MAX_HEIGHT = 112;
// Very wide/tall images are cropped instead of being rendered as a 1px strip.
const PREVIEW_MAX_ASPECT = 4;

interface PreviewSize {
    width: number;
    height: number;
}

export class MenuItem
  extends PopupMenu.PopupBaseMenuItem {

  public cbInfo: ClipboardItem.ClipboardItem;
  private static _sizeCache: Map<string, PreviewSize | null> = new Map();
  private _timeLabel: any;
  private _contentLabel: any;
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
        ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    // Left: content + meta (stacked vertically, expands)
    let bodyBox = new St.BoxLayout({
        ...utils.boxOrientation(Clutter.Orientation.VERTICAL),
        x_expand: true,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.CENTER,
    });

    if (cbInfo.type === ClipboardItem.ClipboardItemType.IMAGE && cbInfo.imagePath) {
      bodyBox.add_child(this._buildThumbnail(cbInfo.imagePath));
    } else {
      this._contentLabel = new St.Label({
          text: cbInfo.display(),
          style_class: 'clipboard-item-text',
          x_align: Clutter.ActorAlign.START,
      });
      this._contentLabel.clutter_text.line_wrap = true;
      bodyBox.add_child(this._contentLabel);
    }

    this._timeLabel = new St.Label({
        text: this._formatRelativeTime(cbInfo.copiedAt),
        style_class: 'clipboard-item-meta',
        x_align: Clutter.ActorAlign.START,
    });
    bodyBox.add_child(this._timeLabel);
    row.add_child(bodyBox);

    // Right: action buttons (pin + remove)
    let actionBox = new St.BoxLayout({
        ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
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

  // Prefer the cached 512px thumbnail; fall back to the original when no
  // thumbnail could be generated (e.g. the first menu build races startup
  // thumbnail generation).
  private _previewSource(imagePath: string): string {
      const thumbPath = thumbnailPathFor(imagePath);
      try {
          if (Gio.File.new_for_path(thumbPath).query_exists(null)) {
              return thumbPath;
          }
      } catch {
          // Fall through to the original image.
      }
      return imagePath;
  }

  private static _measurePreview(path: string): PreviewSize | null {
      try {
          const [, width, height] = GdkPixbuf.Pixbuf.get_file_info(path);
          if (!width || !height) {
              return null;
          }

          // Fit inside the preview box, but never upscale small images.
          const scale = Math.min(
              PREVIEW_MAX_WIDTH / width,
              PREVIEW_MAX_HEIGHT / height,
              1);

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

  private _buildThumbnail(imagePath: string): any {
      let source = this._previewSource(imagePath);
      let size = this._cachedPreviewSize(source);

      // A corrupt/missing thumbnail must not hide a perfectly good source.
      if (!size && source !== imagePath) {
          source = imagePath;
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
      let size = MenuItem._sizeCache.get(source);
      if (size === undefined) {
          size = MenuItem._measurePreview(source);
          MenuItem._sizeCache.set(source, size);
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

  public updateUI() {
    this._timeLabel.set_text(this._formatRelativeTime(this.cbInfo.copiedAt));

    if (this._contentLabel) {
        this._contentLabel.set_text(this.cbInfo.display());
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
      if (diff < 60) return _('Just now');
      if (diff < 3600) return _('%dm ago').replace('%d', String(Math.floor(diff / 60)));
      if (diff < 86400) return _('%dh ago').replace('%d', String(Math.floor(diff / 3600)));
      return _('%dd ago').replace('%d', String(Math.floor(diff / 86400)));
  }

  text(): string {
    return this.cbInfo.text;
  }
}
