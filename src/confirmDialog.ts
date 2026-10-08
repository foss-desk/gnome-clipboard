import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

class ConfirmDialog
  extends ModalDialog.ModalDialog {

  static {
    GObject.registerClass(this);
  }

  constructor(
    title: string,
    desc: string,
    okLabel: string,
    cancelLabel: string,
    callback: () => void) {
    super();

    let main_box = new St.BoxLayout({
      orientation: Clutter.Orientation.HORIZONTAL
    });
    this.contentLayout.add_child(main_box);

    let message_box = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL
    });
    main_box.add_child(message_box);

    let subject_label = new St.Label({
      style: 'font-weight: bold',
      x_align: Clutter.ActorAlign.CENTER,
      text: title
    });
    message_box.add_child(subject_label);

    let desc_label = new St.Label({
      style: 'padding-top: 12px',
      x_align: Clutter.ActorAlign.CENTER,
      text: desc
    });
    message_box.add_child(desc_label);

    this.setButtons([
      {
        label: cancelLabel,
        action: () => {
          this.close();
        },
        key: Clutter.KEY_Escape
      },
      {
        label: okLabel,
        action: () => {
          this.close();
          callback();
        }
      }
    ]);
  }
}

export function openConfirmDialog(
  title: string,
  message: string,
  subMessage: string,
  callback: () => void,
  okLabel = _("OK"),
  cancelLabel = _("Cancel")) {
  let dlg = new ConfirmDialog(title, message + "\n" + subMessage,
    okLabel, cancelLabel, callback);
  dlg.open();
}