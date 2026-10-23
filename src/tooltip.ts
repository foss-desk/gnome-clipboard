import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SHOW_DELAY_MS = 500;
const GAP = 6;

// St.Button has no tooltip of its own, and the action bar is made of bare
// icons. Show a label above the actor after it has been hovered for a moment.
// `dash-label` is the style the Shell uses for the dash tooltips, so it follows
// the theme (light or dark) without any CSS of ours.
export function attachTooltip(actor: any, text: string) {
  let label: any = null;
  let timeoutID = 0;

  const hide = () => {
    if (timeoutID) {
      GLib.source_remove(timeoutID);
      timeoutID = 0;
    }
    if (label) {
      label.destroy();
      label = null;
    }
  };

  const show = () => {
    timeoutID = 0;
    label = new St.Label({ text, style_class: 'dash-label' });
    const layoutManager = (Main as any).layoutManager;
    layoutManager.uiGroup.add_child(label);

    const [x, y] = actor.get_transformed_position();
    const [actorWidth] = actor.get_size();
    const [, labelWidth] = label.get_preferred_width(-1);
    const [, labelHeight] = label.get_preferred_height(-1);
    const monitor = layoutManager.findMonitorForActor(actor);

    let labelX = Math.round(x + (actorWidth - labelWidth) / 2);
    labelX = Math.max(monitor.x + GAP,
      Math.min(labelX, monitor.x + monitor.width - labelWidth - GAP));
    label.set_position(labelX, Math.round(y - labelHeight - GAP));

    return GLib.SOURCE_REMOVE;
  };

  actor.connect('notify::hover', () => {
    hide();
    if (actor.hover) {
      timeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SHOW_DELAY_MS, show);
    }
  });
  actor.connect('clicked', hide);
  actor.connect('destroy', hide);
}
