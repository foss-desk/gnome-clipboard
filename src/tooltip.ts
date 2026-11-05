import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SHOW_DELAY_MS = 500;
const GAP = 6;

export function attachTooltip(actor: any, tooltip: () => string) {
    actor.set_accessible_name(tooltip());

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
        actor.set_accessible_name(tooltip());
        label = new St.Label({ text: tooltip(), style_class: 'dash-label' });
        const layoutManager = (Main as any).layoutManager;
        layoutManager.uiGroup.add_child(label);

        const [x, y] = actor.get_transformed_position();
        const [actorWidth] = actor.get_size();
        const [, labelWidth] = label.get_preferred_width(-1);
        const [, labelHeight] = label.get_preferred_height(-1);
        const monitor = layoutManager.findMonitorForActor(actor);

        let labelX = Math.round(x + (actorWidth - labelWidth) / 2);
        labelX = Math.max(
            monitor.x + GAP,
            Math.min(labelX, monitor.x + monitor.width - labelWidth - GAP),
        );
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
